import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ContactStars } from '../entities/ContactStars';
import { Contacts } from '../entities/Contacts';
import { WorkspaceMembers } from '../entities/WorkspaceMembers';
import { EventsGateway } from '../events/events.gateway';
import { WorkspacesService } from '../workspaces/workspaces.service';
import { CreateContactDto, UpdateContactDto } from './dto/contact.dto';

// 한 사람이 한 워크스페이스에 둘 수 있는 외부 연락처 수
export const MAX_CONTACTS = 1000;

const TEXT_FIELDS = [
  'name',
  'company',
  'department',
  'jobTitle',
  'email',
  'phone',
  'memo',
] as const;

@Injectable()
export class ContactsService {
  constructor(
    @InjectRepository(Contacts)
    private contactsRepository: Repository<Contacts>,
    @InjectRepository(ContactStars)
    private starsRepository: Repository<ContactStars>,
    @InjectRepository(WorkspaceMembers)
    private workspaceMembersRepository: Repository<WorkspaceMembers>,
    private workspacesService: WorkspacesService,
    private eventsGateway: EventsGateway,
  ) {}

  private async findWorkspace(url: string, myId: number) {
    const workspace = await this.workspacesService.findWorkspaceByUrl(url);
    await this.workspacesService.assertMember(workspace.id, myId);
    return workspace;
  }

  private changed(url: string, myId: number) {
    this.eventsGateway.emitToUser(url, myId, 'contactsChanged');
  }

  // 받은 값 중 고칠 수 있는 칸만 골라 다듬는다 (빈 문자열은 null)
  private pick(body: UpdateContactDto) {
    const values: Partial<Contacts> = {};
    TEXT_FIELDS.forEach((key) => {
      if (body[key] !== undefined) {
        values[key] = (body[key] as string | null)?.trim() || null;
      }
    });
    if (values.name === null) {
      throw new BadRequestException('이름을 입력해주세요.');
    }
    if (body.starred !== undefined) {
      values.starred = !!body.starred;
    }
    return values;
  }

  // 내 외부 연락처 (이름순)
  async list(url: string, myId: number) {
    const workspace = await this.findWorkspace(url, myId);
    return this.contactsRepository.find({
      where: { OwnerId: myId, WorkspaceId: workspace.id },
      order: { name: 'ASC', id: 'ASC' },
    });
  }

  async create(url: string, body: CreateContactDto, myId: number) {
    const workspace = await this.findWorkspace(url, myId);
    const count = await this.contactsRepository.count({
      where: { OwnerId: myId, WorkspaceId: workspace.id },
    });
    if (count >= MAX_CONTACTS) {
      throw new BadRequestException(
        `외부 연락처는 ${MAX_CONTACTS}개까지 저장할 수 있습니다.`,
      );
    }
    const contact = await this.contactsRepository.save({
      ...this.pick(body),
      OwnerId: myId,
      WorkspaceId: workspace.id,
    });
    this.changed(url, myId);
    return contact;
  }

  private async findMine(workspaceId: number, id: number, myId: number) {
    const contact = await this.contactsRepository.findOne({
      where: { id, OwnerId: myId, WorkspaceId: workspaceId },
    });
    if (!contact) {
      throw new NotFoundException('존재하지 않는 연락처입니다.');
    }
    return contact;
  }

  async update(url: string, id: number, body: UpdateContactDto, myId: number) {
    const workspace = await this.findWorkspace(url, myId);
    await this.findMine(workspace.id, id, myId);
    const values = this.pick(body);
    if (Object.keys(values).length) {
      await this.contactsRepository.update({ id }, values);
    }
    this.changed(url, myId);
    return this.findMine(workspace.id, id, myId);
  }

  async remove(url: string, id: number, myId: number) {
    const workspace = await this.findWorkspace(url, myId);
    await this.findMine(workspace.id, id, myId);
    await this.contactsRepository.delete({ id });
    this.changed(url, myId);
  }

  // 별표한 동료 id 목록
  async stars(url: string, myId: number) {
    const workspace = await this.findWorkspace(url, myId);
    const rows = await this.starsRepository.find({
      where: { UserId: myId, WorkspaceId: workspace.id },
    });
    return rows.map((r) => r.MemberId);
  }

  async setStar(url: string, memberId: number, starred: boolean, myId: number) {
    const workspace = await this.findWorkspace(url, myId);
    const where = {
      UserId: myId,
      WorkspaceId: workspace.id,
      MemberId: memberId,
    };
    if (!starred) {
      await this.starsRepository.delete(where);
    } else {
      const member = await this.workspaceMembersRepository.findOne({
        where: { WorkspaceId: workspace.id, UserId: memberId },
      });
      if (!member) {
        throw new NotFoundException('워크스페이스에 없는 사용자입니다.');
      }
      if (!(await this.starsRepository.findOne({ where }))) {
        await this.starsRepository.save(where);
      }
    }
    this.changed(url, myId);
  }
}
