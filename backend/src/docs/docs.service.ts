import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { DocFolders } from '../entities/DocFolders';
import { Docs } from '../entities/Docs';
import { DocShares } from '../entities/DocShares';
import { DocUserStates } from '../entities/DocUserStates';
import { DocLinks } from '../entities/DocLinks';
import { DocComments } from '../entities/DocComments';
import { DocAccessRequests } from '../entities/DocAccessRequests';
import { Users } from '../entities/Users';
import { BotsService } from '../bots/bots.service';
import { DmsService } from '../dms/dms.service';
import { DocActivityService } from '../doc-activity/doc-activity.service';
import { EventsGateway } from '../events/events.gateway';
import {
  isAdminRole,
  WorkspaceRole,
  WorkspacesService,
} from '../workspaces/workspaces.service';

const LIST_LIMIT = 100;
const TITLES = {
  doc: '제목 없는 문서',
  wiki: '제목 없는 페이지',
  slides: '제목 없는 슬라이드',
  sheet: '제목 없는 시트',
  board: '제목 없는 보드',
  database: '제목 없는 데이터베이스',
  design: '제목 없는 디자인',
};

const ROLE_TEXT = { view: '보기', edit: '편집' } as const;
// 같은 사람이 같은 문서 권한을 다시 요청해도 이 시간 안에는 다시 알리지 않는다
const REQUEST_RENOTIFY_MS = 10 * 60_000;

// 볼 수 있는 문서: 내가 만들었거나, 워크스페이스 공개거나, 나와 공유됨.
// (고칠 수 있는지는 공유 권한과 공개 문서의 linkRole 로 따로 정한다)
// 게스트는 워크스페이스 공개 문서(위키 포함)는 못 보고, 자기 문서와 공유받은 문서만 본다
// 채널 탭으로 채널 멤버에게 준 권한 (그 채널 멤버일 때만)
const TAB_GRANT = `EXISTS (
  SELECT 1 FROM channeltabs ct JOIN channelmembers cm ON cm.ChannelId = ct.ChannelId
   WHERE ct.DocId = d.id AND ct.access <> 'none' AND cm.UserId = :me)`;
const VISIBLE = `(d.OwnerId = :me OR d.visibility = 'workspace' OR EXISTS (
  SELECT 1 FROM docshares ds WHERE ds.DocId = d.id AND ds.UserId = :me) OR ${TAB_GRANT})`;
const VISIBLE_FOR_GUEST = `(d.OwnerId = :me OR EXISTS (
  SELECT 1 FROM docshares ds WHERE ds.DocId = d.id AND ds.UserId = :me) OR ${TAB_GRANT})`;
export const visibleFor = (role: WorkspaceRole) =>
  role === 'guest' ? VISIBLE_FOR_GUEST : VISIBLE;

@Injectable()
export class DocsService {
  private logger = new Logger('DocsService');

  constructor(
    @InjectRepository(Docs) private docsRepository: Repository<Docs>,
    @InjectRepository(DocFolders)
    private foldersRepository: Repository<DocFolders>,
    @InjectRepository(DocShares)
    private sharesRepository: Repository<DocShares>,
    @InjectRepository(DocUserStates)
    private statesRepository: Repository<DocUserStates>,
    @InjectRepository(DocLinks)
    private linksRepository: Repository<DocLinks>,
    @InjectRepository(DocComments)
    private commentsRepository: Repository<DocComments>,
    private workspacesService: WorkspacesService,
    private eventsGateway: EventsGateway,
    @InjectRepository(DocAccessRequests)
    private requestsRepository: Repository<DocAccessRequests>,
    // 접근 요청을 봇 DM 으로 알린다 (테스트처럼 없으면 화면 알림만)
    @Optional() private botsService?: BotsService,
    @Optional() private dmsService?: DmsService,
    // 채널 탭에서 알림을 켠 채널에 댓글·수정을 알린다
    @Optional() private activity?: DocActivityService,
  ) {}

  // 이 사람이 이 문서를 볼 수 있는지·고칠 수 있는지
  private async permissionOf(doc: Docs, role: WorkspaceRole, userId: number) {
    const share = await this.sharesRepository.findOne({
      where: { DocId: doc.id, UserId: userId },
    });
    const isOwner = doc.OwnerId === userId;
    const openToAll = doc.visibility === 'workspace' && role !== 'guest';
    const tab = await this.tabGrant(doc.id, userId);
    return {
      canView: isOwner || openToAll || !!share || tab !== 'none',
      canEdit:
        isOwner ||
        share?.role === 'edit' ||
        tab === 'edit' ||
        (openToAll && doc.linkRole === 'edit'),
    };
  }

  // 이 사람이 들어가 있는 채널의 탭으로 받은 가장 큰 권한
  private async tabGrant(docId: number, userId: number) {
    const rows: { level: number | string | null }[] =
      await this.docsRepository.manager.query(
        `SELECT MAX(CASE ct.access WHEN 'edit' THEN 2 WHEN 'view' THEN 1 ELSE 0 END) AS level
           FROM channeltabs ct
           JOIN channelmembers cm ON cm.ChannelId = ct.ChannelId AND cm.UserId = ?
          WHERE ct.DocId = ?`,
        [userId, docId],
      );
    const level = Number(rows[0]?.level || 0);
    return level >= 2 ? 'edit' : level === 1 ? 'view' : 'none';
  }

  // 워크스페이스 멤버가 아니면 볼 수 없다
  private async canViewDoc(doc: Docs, userId: number) {
    const role = await this.workspacesService.roleOf(doc.WorkspaceId, userId);
    return !!role && (await this.permissionOf(doc, role, userId)).canView;
  }

  // 권한이 바뀌었다: 이미 열어 둔 공동 편집 연결의 권한을 다시 계산한다 (userId 가 있으면 그 사람만)
  private accessChanged(url: string, docId: number, userId?: number) {
    this.eventsGateway.docAccessChanged(url, docId, userId);
  }

  private async findWorkspace(url: string, myId: number) {
    const workspace = await this.workspacesService.findWorkspaceByUrl(url);
    const role = await this.workspacesService.assertMember(workspace.id, myId);
    return Object.assign(workspace, { role });
  }

  // 문서 하나와 내 권한 (보기·편집·관리)
  private async access(
    url: string,
    id: number,
    myId: number,
    withDeleted = false,
  ) {
    const workspace = await this.findWorkspace(url, myId);
    const doc = await this.docsRepository.findOne({
      where: { id, WorkspaceId: workspace.id },
      withDeleted,
    });
    if (!doc) {
      throw new NotFoundException('존재하지 않는 문서입니다.');
    }
    const { canView, canEdit } = await this.permissionOf(
      doc,
      workspace.role,
      myId,
    );
    if (!canView) {
      // 볼 수 없는 문서는 있는지도 알리지 않는다
      throw new NotFoundException('존재하지 않는 문서입니다.');
    }
    const canManage = doc.OwnerId === myId || isAdminRole(workspace.role);
    return { workspace, doc, canEdit, canManage };
  }

  // 다른 기능(채널 탭)에서 내 권한을 확인할 때. 볼 수 없으면 null
  async accessOf(url: string, id: number, myId: number) {
    try {
      const { doc, canEdit, canManage } = await this.access(url, id, myId);
      return { doc, canEdit, canManage };
    } catch (error) {
      if (error instanceof NotFoundException) return null;
      throw error;
    }
  }

  // 실시간 동시 편집: 볼 수 있는지·고칠 수 있는지 (소켓 연결에서 쓴다)
  async collabAccess(url: string, id: number, myId: number) {
    const { doc, canEdit } = await this.access(url, id, myId);
    return { doc, canEdit };
  }

  async loadYdoc(id: number) {
    const row = await this.docsRepository.findOne({
      where: { id },
      select: ['id', 'ydoc'],
    });
    return row?.ydoc || null;
  }

  // 공동 편집 상태 저장. 검색·미리보기용 글(content)이 오면 함께 바꾼다
  async saveYdoc(
    url: string,
    id: number,
    state: Uint8Array,
    editorId: number | null,
    content?: string,
  ) {
    const update: Partial<Docs> = { ydoc: Buffer.from(state) };
    if (editorId) {
      update.LastEditorId = editorId;
    }
    if (content !== undefined) {
      update.content = content;
    }
    await this.docsRepository.update({ id }, update);
    if (content !== undefined) {
      await this.updateLinks(url, id, content);
    }
    if (editorId) {
      void this.activity?.edited(id, editorId);
    }
  }

  // 문서 안의 다른 문서 링크(/workspace/주소/docs/d/번호)를 기억한다 (백링크용)
  private async updateLinks(url: string, id: number, content: string) {
    const escaped = url.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const pattern = new RegExp(`/workspace/${escaped}/docs/d/(\\d+)`, 'g');
    const ids = [
      ...new Set([...content.matchAll(pattern)].map((m) => Number(m[1]))),
    ]
      .filter((to) => to !== id)
      .slice(0, 500);
    const doc = await this.docsRepository.findOne({
      where: { id },
      select: ['id', 'WorkspaceId'],
    });
    const valid = ids.length
      ? await this.docsRepository.find({
          where: { id: In(ids), WorkspaceId: doc?.WorkspaceId },
          select: ['id'],
          withDeleted: true,
        })
      : [];
    await this.linksRepository.delete({ FromId: id });
    if (valid.length) {
      await this.linksRepository.insert(
        valid.map((d) => ({ FromId: id, ToId: d.id })),
      );
    }
  }

  // 페이지 링크에 보여 줄 제목 (최근 목록에 올리지 않는다)
  async getDocTitle(url: string, id: number, myId: number) {
    const { doc } = await this.access(url, id, myId);
    return { id: doc.id, title: doc.title, type: doc.type };
  }

  // 이 문서를 링크한 문서들 (내가 볼 수 있는 것만)
  async getBacklinks(url: string, id: number, myId: number) {
    const { doc, workspace } = await this.access(url, id, myId);
    return this.docsRepository
      .createQueryBuilder('d')
      .innerJoin(DocLinks, 'l', 'l.FromId = d.id AND l.ToId = :to', {
        to: doc.id,
      })
      .select(['d.id', 'd.title', 'd.type'])
      .where(visibleFor(workspace.role), { me: myId })
      .orderBy('d.updatedAt', 'DESC')
      .limit(50)
      .getMany();
  }

  // ---- 댓글 ----

  private commentNotify(url: string, docId: number) {
    this.eventsGateway.emitToWorkspace(url, 'docCommentsChanged', { docId });
  }

  async listComments(url: string, id: number, myId: number) {
    const { doc } = await this.access(url, id, myId);
    return this.commentsRepository
      .createQueryBuilder('c')
      .leftJoin('c.User', 'u')
      .addSelect(['u.id', 'u.nickname', 'u.email', 'u.avatarStyle'])
      .where('c.DocId = :id', { id: doc.id })
      .orderBy('c.createdAt', 'ASC')
      .addOrderBy('c.id', 'ASC')
      .getMany();
  }

  // 댓글은 볼 수 있는 사람이면 누구나 단다 (보기만 가능한 사람도 의견을 남길 수 있게)
  async addComment(
    url: string,
    id: number,
    dto: { threadId: string; content: string; quote?: string },
    myId: number,
  ) {
    const { doc } = await this.access(url, id, myId);
    const content = dto.content.trim();
    if (!content) {
      throw new BadRequestException('댓글을 입력해주세요.');
    }
    const first = await this.commentsRepository.findOne({
      where: { DocId: doc.id, threadId: dto.threadId },
      order: { id: 'ASC' },
    });
    const saved = await this.commentsRepository.save({
      DocId: doc.id,
      UserId: myId,
      threadId: dto.threadId,
      content,
      // 인용한 글은 스레드 첫 댓글에만
      quote: first ? null : dto.quote?.trim().slice(0, 300) || null,
    });
    this.commentNotify(url, doc.id);
    void this.activity?.comment(doc.id, myId, content);
    // 문서 주인과 이 스레드에 댓글을 단 사람들에게 알린다 (나 빼고)
    const participants = first
      ? await this.commentsRepository
          .createQueryBuilder('c')
          .select('DISTINCT c.UserId', 'userId')
          .where('c.DocId = :id AND c.threadId = :threadId', {
            id: doc.id,
            threadId: dto.threadId,
          })
          .getRawMany<{ userId: number }>()
      : [];
    const targets = new Set(
      [doc.OwnerId, ...participants.map((p) => Number(p.userId))].filter(
        (userId): userId is number => !!userId && userId !== myId,
      ),
    );
    for (const userId of targets) {
      // 그 사이 권한을 잃은 사람에게는 제목·내용을 보내지 않는다
      if (!(await this.canViewDoc(doc, userId))) continue;
      this.eventsGateway.emitToUser(url, userId, 'docComment', {
        docId: doc.id,
        title: doc.title,
        authorId: myId,
        content: content.slice(0, 100),
      });
    }
    return saved;
  }

  private async findComment(docId: number, commentId: number) {
    const comment = await this.commentsRepository.findOne({
      where: { id: commentId, DocId: docId },
    });
    if (!comment) {
      throw new NotFoundException('존재하지 않는 댓글입니다.');
    }
    return comment;
  }

  async editComment(
    url: string,
    id: number,
    commentId: number,
    content: string,
    myId: number,
  ) {
    const { doc } = await this.access(url, id, myId);
    const comment = await this.findComment(doc.id, commentId);
    if (comment.UserId !== myId) {
      throw new ForbiddenException('내가 쓴 댓글만 고칠 수 있습니다.');
    }
    if (!content.trim()) {
      throw new BadRequestException('댓글을 입력해주세요.');
    }
    await this.commentsRepository.update(comment.id, {
      content: content.trim(),
      editedAt: new Date(),
    });
    this.commentNotify(url, doc.id);
  }

  async deleteComment(
    url: string,
    id: number,
    commentId: number,
    myId: number,
  ) {
    const { doc, canManage } = await this.access(url, id, myId);
    const comment = await this.findComment(doc.id, commentId);
    if (comment.UserId !== myId && !canManage && doc.OwnerId !== myId) {
      throw new ForbiddenException('내가 쓴 댓글만 지울 수 있습니다.');
    }
    await this.commentsRepository.delete(comment.id);
    this.commentNotify(url, doc.id);
  }

  async resolveThread(
    url: string,
    id: number,
    threadId: string,
    resolved: boolean,
    myId: number,
  ) {
    const { doc } = await this.access(url, id, myId);
    await this.commentsRepository.update(
      { DocId: doc.id, threadId },
      { resolved },
    );
    this.commentNotify(url, doc.id);
  }

  private notify(url: string, data: Record<string, unknown>) {
    this.eventsGateway.emitToWorkspace(url, 'docsChanged', data);
  }

  // 폴더는 나만 보므로 내 다른 기기에만 알린다
  private notifyMe(url: string, myId: number) {
    this.eventsGateway.emitToUser(url, myId, 'docsChanged', {});
  }

  async listDocs(
    url: string,
    query: { tab?: string; q?: string; folderId?: number; type?: string },
    myId: number,
  ) {
    const workspace = await this.findWorkspace(url, myId);
    const tab = query.tab || 'recent';
    const qb = this.docsRepository
      .createQueryBuilder('d')
      .leftJoin('d.Owner', 'o')
      .leftJoin('d.Folder', 'f')
      .leftJoin(DocUserStates, 's', 's.DocId = d.id AND s.UserId = :me', {
        me: myId,
      })
      .select([
        'd.id AS id',
        'd.title AS title',
        'd.type AS type',
        'd.visibility AS visibility',
        'd.FolderId AS folderId',
        'd.ParentId AS parentId',
        'd.OwnerId AS ownerId',
        'd.createdAt AS createdAt',
        'd.updatedAt AS updatedAt',
        'd.deletedAt AS deletedAt',
        'o.nickname AS ownerName',
        'o.email AS ownerEmail',
        'o.avatarStyle AS ownerAvatarStyle',
        'f.name AS folderName',
        's.favorite AS favorite',
        's.viewedAt AS viewedAt',
      ])
      .where('d.WorkspaceId = :workspaceId', { workspaceId: workspace.id })
      .andWhere(visibleFor(workspace.role), { me: myId });
    if (query.type) {
      qb.andWhere('d.type = :type', { type: query.type });
    }
    if (query.q?.trim()) {
      qb.andWhere('d.title LIKE :q', {
        q: `%${query.q.trim().replace(/[\\%_]/g, (c) => `\\${c}`)}%`,
      });
    }
    switch (tab) {
      case 'recent':
        qb.andWhere('s.viewedAt IS NOT NULL').orderBy('s.viewedAt', 'DESC');
        break;
      case 'mine':
        qb.andWhere('d.OwnerId = :me').orderBy('d.updatedAt', 'DESC');
        break;
      case 'shared':
        qb.andWhere('d.OwnerId <> :me')
          .andWhere(
            'EXISTS (SELECT 1 FROM docshares sh WHERE sh.DocId = d.id AND sh.UserId = :me)',
          )
          .orderBy('d.updatedAt', 'DESC');
        break;
      case 'favorites':
        qb.andWhere('s.favorite = 1').orderBy('d.title', 'ASC');
        break;
      case 'trash':
        qb.withDeleted()
          .andWhere('d.deletedAt IS NOT NULL')
          .andWhere('d.OwnerId = :me')
          .orderBy('d.deletedAt', 'DESC');
        break;
      case 'folder':
        qb.andWhere('d.FolderId = :folderId', { folderId: query.folderId || 0 })
          .andWhere('d.OwnerId = :me')
          .orderBy('d.title', 'ASC');
        break;
      default:
        qb.orderBy('d.updatedAt', 'DESC');
    }
    const rows = await qb.limit(LIST_LIMIT).getRawMany();
    return rows.map((row) => ({ ...row, favorite: !!Number(row.favorite) }));
  }

  // 위키: 워크스페이스 공개 위키 페이지 트리 (내용 없이)
  async getWikiTree(url: string, myId: number) {
    const workspace = await this.findWorkspace(url, myId);
    if (workspace.role === 'guest') {
      return [];
    }
    return this.docsRepository.find({
      where: { WorkspaceId: workspace.id, type: 'wiki' },
      select: ['id', 'title', 'ParentId', 'updatedAt'],
      order: { title: 'ASC' },
    });
  }

  async getDoc(url: string, id: number, myId: number) {
    const { doc, canEdit, canManage } = await this.access(url, id, myId, true);
    if (doc.deletedAt && doc.OwnerId !== myId) {
      throw new NotFoundException('존재하지 않는 문서입니다.');
    }
    const full = await this.docsRepository.findOne({
      where: { id: doc.id },
      relations: ['Owner', 'LastEditor', 'Folder', 'Shares', 'Shares.User'],
      withDeleted: true,
    });
    const state = await this.statesRepository.findOne({
      where: { UserId: myId, DocId: doc.id },
    });
    // 최근 목록에 올린다
    await this.statesRepository.save({
      UserId: myId,
      DocId: doc.id,
      favorite: state?.favorite || false,
      viewedAt: new Date(),
    });
    // 관리할 수 있으면 기다리는 접근 요청 수와 채널 탭으로 준 권한도 알려 준다
    const accessRequests = canManage
      ? await this.requestsRepository.count({ where: { DocId: doc.id } })
      : 0;
    const channelTabs: { channel: string; access: string }[] = canManage
      ? await this.docsRepository.manager.query(
          `SELECT c.name AS channel, ct.access AS access
             FROM channeltabs ct JOIN channels c ON c.id = ct.ChannelId
            WHERE ct.DocId = ? ORDER BY c.name`,
          [doc.id],
        )
      : [];
    return {
      ...full,
      canEdit,
      canManage,
      accessRequests,
      channelTabs,
      favorite: !!state?.favorite,
    };
  }

  private async assertMyFolder(
    workspaceId: number,
    folderId: number,
    myId: number,
  ) {
    const folder = await this.foldersRepository.findOne({
      where: { id: folderId, WorkspaceId: workspaceId, OwnerId: myId },
    });
    if (!folder) {
      throw new NotFoundException('존재하지 않는 폴더입니다.');
    }
    return folder;
  }

  private async assertWikiParent(workspaceId: number, parentId: number) {
    const parent = await this.docsRepository.findOne({
      where: { id: parentId, WorkspaceId: workspaceId, type: 'wiki' },
    });
    if (!parent) {
      throw new NotFoundException('존재하지 않는 상위 페이지입니다.');
    }
  }

  async createDoc(
    url: string,
    dto: {
      type:
        | 'doc'
        | 'wiki'
        | 'slides'
        | 'sheet'
        | 'board'
        | 'database'
        | 'design';
      title?: string;
      content?: string;
      visibility?: 'private' | 'workspace';
      linkRole?: 'view' | 'edit';
      folderId?: number;
      parentId?: number;
    },
    myId: number,
  ) {
    const workspace = await this.findWorkspace(url, myId);
    const isWiki = dto.type === 'wiki';
    if (
      workspace.role === 'guest' &&
      (isWiki || dto.visibility === 'workspace')
    ) {
      throw new ForbiddenException('게스트는 비공개 문서만 만들 수 있습니다.');
    }
    if (dto.folderId && !isWiki) {
      await this.assertMyFolder(workspace.id, dto.folderId, myId);
    }
    if (dto.parentId) {
      if (!isWiki) {
        throw new BadRequestException(
          '상위 페이지는 위키에서만 지정할 수 있습니다.',
        );
      }
      await this.assertWikiParent(workspace.id, dto.parentId);
    }
    const doc = await this.docsRepository.save({
      WorkspaceId: workspace.id,
      type: dto.type,
      title: dto.title?.trim() || TITLES[dto.type],
      content: dto.content || '',
      // 위키는 워크스페이스 모두의 공간 (모두 고칠 수 있게 시작한다)
      visibility: isWiki ? 'workspace' : dto.visibility || 'private',
      linkRole: dto.linkRole || (isWiki ? 'edit' : 'view'),
      FolderId: isWiki ? null : dto.folderId || null,
      ParentId: isWiki ? dto.parentId || null : null,
      OwnerId: myId,
      LastEditorId: myId,
    });
    this.notify(url, { id: doc.id });
    return doc;
  }

  async updateDoc(
    url: string,
    id: number,
    dto: { title?: string; content?: string; version: number },
    myId: number,
  ) {
    const { doc, canEdit } = await this.access(url, id, myId);
    if (!canEdit) {
      throw new ForbiddenException('이 문서를 고칠 권한이 없습니다.');
    }
    if (dto.version !== doc.version) {
      throw new ConflictException(
        '다른 사람이 먼저 이 문서를 고쳤습니다. 최신 내용을 불러온 뒤 다시 고쳐 주세요.',
      );
    }
    const update: Partial<Docs> = {
      version: doc.version + 1,
      LastEditorId: myId,
    };
    if (dto.title !== undefined) {
      update.title = dto.title.trim() || TITLES[doc.type];
    }
    if (dto.content !== undefined) {
      update.content = dto.content;
    }
    // 버전이 그대로일 때만 저장 (동시에 저장하는 경우까지 막는다)
    const result = await this.docsRepository.update(
      { id: doc.id, version: doc.version },
      update,
    );
    if (!result.affected) {
      throw new ConflictException(
        '다른 사람이 먼저 이 문서를 고쳤습니다. 최신 내용을 불러온 뒤 다시 고쳐 주세요.',
      );
    }
    this.eventsGateway.emitToWorkspace(url, 'docUpdated', {
      id: doc.id,
      version: update.version,
      editorId: myId,
    });
    if (update.title && update.title !== doc.title) {
      this.notify(url, { id: doc.id });
    }
    void this.activity?.edited(doc.id, myId);
    return {
      id: doc.id,
      version: update.version,
      title: update.title ?? doc.title,
    };
  }

  async updateSettings(
    url: string,
    id: number,
    dto: {
      visibility?: 'private' | 'workspace';
      linkRole?: 'view' | 'edit';
      folderId?: number | null;
      parentId?: number | null;
    },
    myId: number,
  ) {
    const { workspace, doc, canManage } = await this.access(url, id, myId);
    const update: Partial<Docs> = {};
    if (dto.folderId !== undefined) {
      // 폴더는 내 라이브러리 정리용이라 문서를 만든 사람만 옮긴다
      if (doc.OwnerId !== myId || doc.type === 'wiki') {
        throw new ForbiddenException('내 문서만 내 폴더로 옮길 수 있습니다.');
      }
      if (dto.folderId) {
        await this.assertMyFolder(workspace.id, dto.folderId, myId);
      }
      update.FolderId = dto.folderId;
    }
    if (
      dto.visibility !== undefined ||
      dto.linkRole !== undefined ||
      dto.parentId !== undefined
    ) {
      if (!canManage) {
        throw new ForbiddenException(
          '문서를 만든 사람이나 워크스페이스 관리자만 할 수 있습니다.',
        );
      }
    }
    if (dto.visibility !== undefined) {
      if (dto.visibility === 'workspace' && workspace.role === 'guest') {
        throw new ForbiddenException(
          '게스트는 문서를 워크스페이스에 공개할 수 없습니다.',
        );
      }
      if (doc.type === 'wiki') {
        throw new BadRequestException(
          '위키 페이지는 항상 워크스페이스 공개입니다.',
        );
      }
      update.visibility = dto.visibility;
    }
    if (dto.linkRole !== undefined) {
      update.linkRole = dto.linkRole;
    }
    if (dto.parentId !== undefined) {
      if (doc.type !== 'wiki') {
        throw new BadRequestException(
          '상위 페이지는 위키에서만 지정할 수 있습니다.',
        );
      }
      if (dto.parentId) {
        if (dto.parentId === doc.id) {
          throw new BadRequestException('자기 자신 아래로 옮길 수 없습니다.');
        }
        await this.assertWikiParent(workspace.id, dto.parentId);
        // 내 하위 페이지 아래로 옮기면 고리가 생긴다
        let cursor: number | null = dto.parentId;
        while (cursor) {
          if (cursor === doc.id) {
            throw new BadRequestException(
              '하위 페이지 아래로 옮길 수 없습니다.',
            );
          }
          const parent = await this.docsRepository.findOne({
            where: { id: cursor },
            select: ['id', 'ParentId'],
          });
          cursor = parent?.ParentId || null;
        }
      }
      update.ParentId = dto.parentId;
    }
    if (Object.keys(update).length) {
      await this.docsRepository.update(doc.id, update);
      this.notify(url, { id: doc.id });
      if (update.visibility !== undefined || update.linkRole !== undefined) {
        this.accessChanged(url, doc.id);
      }
    }
    return this.docsRepository.findOne({ where: { id: doc.id } });
  }

  async setShare(
    url: string,
    id: number,
    userId: number,
    role: 'view' | 'edit',
    myId: number,
  ) {
    const { workspace, doc, canManage } = await this.access(url, id, myId);
    if (!canManage) {
      throw new ForbiddenException(
        '문서를 만든 사람이나 워크스페이스 관리자만 공유할 수 있습니다.',
      );
    }
    if (userId === doc.OwnerId) {
      throw new BadRequestException(
        '문서를 만든 사람은 이미 모든 권한이 있습니다.',
      );
    }
    await this.workspacesService.assertMember(workspace.id, userId);
    await this.sharesRepository.save({ DocId: doc.id, UserId: userId, role });
    // 권한을 받았으니 그 사람의 기다리던 요청은 지운다
    await this.requestsRepository.delete({ DocId: doc.id, UserId: userId });
    this.notify(url, { id: doc.id });
    this.accessChanged(url, doc.id, userId);
    // 공유받은 사람에게 알린다
    this.eventsGateway.emitToUser(url, userId, 'docShared', {
      id: doc.id,
      title: doc.title,
      role,
    });
  }

  // 채널 사람들 모두에게 보기 권한을 준다 (채널에 문서를 보낼 때). 이미 편집 권한이 있으면 그대로 둔다
  async shareWithChannel(
    url: string,
    id: number,
    channelName: string,
    myId: number,
  ) {
    const { workspace, doc, canManage } = await this.access(url, id, myId);
    if (!canManage) {
      throw new ForbiddenException(
        '문서를 만든 사람이나 워크스페이스 관리자만 공유할 수 있습니다.',
      );
    }
    const rows: { id: number }[] = await this.docsRepository.manager.query(
      `SELECT cm.UserId AS id
         FROM channels c
         JOIN channelmembers cm ON cm.ChannelId = c.id
         JOIN users u ON u.id = cm.UserId AND u.bot = 0
        WHERE c.WorkspaceId = ? AND c.name = ?
          AND EXISTS (SELECT 1 FROM channelmembers me WHERE me.ChannelId = c.id AND me.UserId = ?)`,
      [workspace.id, channelName, myId],
    );
    if (!rows.length) {
      throw new NotFoundException('존재하지 않는 채널입니다.');
    }
    const existing = await this.sharesRepository.find({
      where: { DocId: doc.id },
      select: ['UserId'],
    });
    const already = new Set(existing.map((s) => s.UserId));
    const added = rows
      .map((r) => Number(r.id))
      .filter((uid) => uid !== doc.OwnerId && !already.has(uid));
    if (added.length) {
      await this.sharesRepository.save(
        added.map((uid) => ({
          DocId: doc.id,
          UserId: uid,
          role: 'view' as const,
        })),
      );
      this.notify(url, { id: doc.id });
    }
    return { added: added.length };
  }

  async removeShare(url: string, id: number, userId: number, myId: number) {
    const { doc, canManage } = await this.access(url, id, myId);
    if (!canManage && userId !== myId) {
      throw new ForbiddenException(
        '문서를 만든 사람이나 워크스페이스 관리자만 할 수 있습니다.',
      );
    }
    await this.sharesRepository.delete({ DocId: doc.id, UserId: userId });
    this.notify(url, { id: doc.id });
    this.accessChanged(url, doc.id, userId);
  }

  async setFavorite(url: string, id: number, favorite: boolean, myId: number) {
    const { doc } = await this.access(url, id, myId);
    const state = await this.statesRepository.findOne({
      where: { UserId: myId, DocId: doc.id },
    });
    await this.statesRepository.save({
      UserId: myId,
      DocId: doc.id,
      favorite,
      viewedAt: state?.viewedAt || null,
    });
    // 고정 목록은 나만의 것이라 내 다른 기기에만 알린다
    this.notifyMe(url, myId);
  }

  // 휴지통으로 (만든 사람·소유자), 되살리기, 영구 삭제 (만든 사람)
  async trashDoc(url: string, id: number, myId: number) {
    const { doc, canManage } = await this.access(url, id, myId);
    if (!canManage) {
      throw new ForbiddenException(
        '문서를 만든 사람이나 워크스페이스 관리자만 지울 수 있습니다.',
      );
    }
    await this.docsRepository.softDelete(doc.id);
    this.notify(url, { id: doc.id });
    // 휴지통에 들어간 문서는 아무도 계속 고칠 수 없다
    this.accessChanged(url, doc.id);
  }

  async restoreDoc(url: string, id: number, myId: number) {
    const { doc } = await this.access(url, id, myId, true);
    if (doc.OwnerId !== myId) {
      throw new ForbiddenException('문서를 만든 사람만 되살릴 수 있습니다.');
    }
    await this.docsRepository.restore(doc.id);
    this.notify(url, { id: doc.id });
  }

  async deleteForever(url: string, id: number, myId: number) {
    const { doc } = await this.access(url, id, myId, true);
    if (doc.OwnerId !== myId || !doc.deletedAt) {
      throw new ForbiddenException(
        '휴지통에 있는 내 문서만 영구 삭제할 수 있습니다.',
      );
    }
    await this.docsRepository.delete(doc.id);
  }

  // ── 접근 요청 (링크로 열었는데 권한이 없을 때)

  // 권한이 없는 사람이 문서 주인에게 보기·편집 권한을 요청한다.
  // 요청한 사람은 아직 볼 수 없으므로 제목 같은 내용은 돌려주지 않는다
  async requestAccess(
    url: string,
    id: number,
    dto: { role: 'view' | 'edit'; message?: string },
    myId: number,
  ) {
    const workspace = await this.findWorkspace(url, myId);
    const doc = await this.docsRepository.findOne({
      where: { id, WorkspaceId: workspace.id },
    });
    if (!doc) {
      throw new NotFoundException('존재하지 않는 문서입니다.');
    }
    const current = await this.permissionOf(doc, workspace.role, myId);
    if (current.canEdit || (dto.role === 'view' && current.canView)) {
      throw new BadRequestException('이미 그 권한이 있습니다.');
    }
    const message = dto.message?.trim().slice(0, 300) || null;
    const existing = await this.requestsRepository.findOne({
      where: { DocId: doc.id, UserId: myId },
    });
    const now = new Date();
    const renotify =
      !existing ||
      now.getTime() - new Date(existing.requestedAt).getTime() >
        REQUEST_RENOTIFY_MS ||
      (existing.role === 'view' && dto.role === 'edit');
    await this.requestsRepository.save({
      id: existing?.id,
      DocId: doc.id,
      UserId: myId,
      role: dto.role,
      message,
      requestedAt: renotify ? now : existing!.requestedAt,
    });
    if (renotify) {
      await this.notifyAccessRequest(
        url,
        workspace,
        doc,
        myId,
        dto.role,
        message,
      );
    }
    return { requested: true };
  }

  // 요청을 받을 사람: 문서 주인 (없거나 워크스페이스를 떠났으면 워크스페이스 소유자)
  private async notifyAccessRequest(
    url: string,
    workspace: { id: number; OwnerId: number },
    doc: Docs,
    requesterId: number,
    role: 'view' | 'edit',
    message: string | null,
  ) {
    const ownerRole = doc.OwnerId
      ? await this.workspacesService.roleOf(workspace.id, doc.OwnerId)
      : null;
    const managerId = ownerRole ? doc.OwnerId! : workspace.OwnerId;
    this.eventsGateway.emitToUser(url, managerId, 'docsChanged', {
      id: doc.id,
    });
    if (!this.botsService || !this.dmsService) return;
    try {
      const requester = await this.docsRepository.manager.findOne(Users, {
        where: { id: requesterId },
        select: ['id', 'nickname'],
      });
      const botId = await this.botsService.ensureMember(workspace.id);
      const text = `🔐 ${requester?.nickname || '누군가'} 님이 문서 **${
        doc.title
      }** ${ROLE_TEXT[role]} 권한을 요청했어요${
        message ? `: “${message}”` : ''
      }\n공유 창에서 허락하거나 거절할 수 있어요.\n/workspace/${url}/docs/d/${
        doc.id
      }`;
      await this.dmsService.createWorkspaceDMChats(url, text, managerId, botId);
    } catch (error) {
      this.logger.warn(
        `접근 요청을 알리지 못했습니다: ${(error as Error).message}`,
      );
    }
  }

  // 기다리는 접근 요청 (문서 주인·관리자)
  async listAccessRequests(url: string, id: number, myId: number) {
    const { doc, canManage } = await this.access(url, id, myId);
    if (!canManage) {
      throw new ForbiddenException(
        '문서를 만든 사람이나 워크스페이스 관리자만 볼 수 있습니다.',
      );
    }
    return this.requestsRepository
      .createQueryBuilder('r')
      .leftJoin('r.User', 'u')
      .select([
        'r.id',
        'r.UserId',
        'r.role',
        'r.message',
        'r.requestedAt',
        'u.id',
        'u.nickname',
        'u.email',
        'u.avatarStyle',
      ])
      .where('r.DocId = :id', { id: doc.id })
      .orderBy('r.requestedAt', 'ASC')
      .getMany();
  }

  // 요청 허락(공유 추가) 또는 거절. 어느 쪽이든 요청한 사람에게 알린다
  async decideAccessRequest(
    url: string,
    id: number,
    requestId: number,
    dto: { decision: 'approve' | 'deny'; role?: 'view' | 'edit' },
    myId: number,
  ) {
    const { workspace, doc, canManage } = await this.access(url, id, myId);
    if (!canManage) {
      throw new ForbiddenException(
        '문서를 만든 사람이나 워크스페이스 관리자만 할 수 있습니다.',
      );
    }
    const request = await this.requestsRepository.findOne({
      where: { id: requestId, DocId: doc.id },
    });
    if (!request) {
      throw new NotFoundException('이미 처리된 요청입니다.');
    }
    const role = dto.role || request.role;
    if (dto.decision === 'approve') {
      // 요청한 사람이 워크스페이스를 떠났으면 여기서 막힌다
      await this.setShare(url, doc.id, request.UserId, role, myId);
    }
    await this.requestsRepository.delete(request.id);
    this.notify(url, { id: doc.id });
    this.eventsGateway.emitToUser(url, request.UserId, 'docAccess', {
      id: doc.id,
      decision: dto.decision,
    });
    if (this.botsService && this.dmsService) {
      try {
        const botId = await this.botsService.ensureMember(workspace.id);
        // 거절이면 제목을 알리지 않는다 (볼 권한이 없으니)
        const text =
          dto.decision === 'approve'
            ? `✅ 문서 **${doc.title}** ${ROLE_TEXT[role]} 권한을 받았어요.\n/workspace/${url}/docs/d/${doc.id}`
            : `요청하신 문서 권한은 허락되지 않았어요. (문서 번호 ${doc.id})`;
        await this.dmsService.createWorkspaceDMChats(
          url,
          text,
          request.UserId,
          botId,
        );
      } catch (error) {
        this.logger.warn(
          `요청 결과를 알리지 못했습니다: ${(error as Error).message}`,
        );
      }
    }
    return { decision: dto.decision, role };
  }

  // ── 폴더 (내 문서 라이브러리)
  async getFolders(url: string, myId: number) {
    const workspace = await this.findWorkspace(url, myId);
    return this.foldersRepository.find({
      where: { WorkspaceId: workspace.id, OwnerId: myId },
      order: { name: 'ASC' },
    });
  }

  async createFolder(
    url: string,
    name: string,
    parentId: number | null,
    myId: number,
  ) {
    const workspace = await this.findWorkspace(url, myId);
    if (parentId) {
      await this.assertMyFolder(workspace.id, parentId, myId);
    }
    const folder = await this.foldersRepository.save({
      WorkspaceId: workspace.id,
      name: name.trim() || '새 폴더',
      ParentId: parentId || null,
      OwnerId: myId,
    });
    this.notifyMe(url, myId);
    return folder;
  }

  async updateFolder(
    url: string,
    id: number,
    dto: { name?: string; parentId?: number | null },
    myId: number,
  ) {
    const workspace = await this.findWorkspace(url, myId);
    const folder = await this.assertMyFolder(workspace.id, id, myId);
    const update: Partial<DocFolders> = {};
    if (dto.name !== undefined) {
      update.name = dto.name.trim() || folder.name;
    }
    if (dto.parentId !== undefined) {
      let cursor = dto.parentId;
      while (cursor) {
        if (cursor === folder.id) {
          throw new BadRequestException('하위 폴더 안으로 옮길 수 없습니다.');
        }
        const parent = await this.assertMyFolder(workspace.id, cursor, myId);
        cursor = parent.ParentId;
      }
      update.ParentId = dto.parentId;
    }
    await this.foldersRepository.update(folder.id, update);
    this.notifyMe(url, myId);
    return this.foldersRepository.findOne({ where: { id: folder.id } });
  }

  async deleteFolder(url: string, id: number, myId: number) {
    const workspace = await this.findWorkspace(url, myId);
    const folder = await this.assertMyFolder(workspace.id, id, myId);
    // 하위 폴더는 함께 지워지고, 안의 문서는 폴더 밖(내 라이브러리)으로 나온다
    await this.foldersRepository.delete(folder.id);
    this.notifyMe(url, myId);
  }
}
