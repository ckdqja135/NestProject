import '@excalidraw/excalidraw/index.css';
import {
  CaptureUpdateAction,
  convertToExcalidrawElements,
  Excalidraw,
  MainMenu,
  reconcileElements,
  WelcomeScreen,
} from '@excalidraw/excalidraw';
import useCollab from '@hooks/useCollab';
import { IUser } from '@typings/db';
import React, { FC, useEffect, useRef, useState } from 'react';
import { BoardWrap } from './styles';
import { parseBoardTemplate } from './templates';

// 화이트보드: Excalidraw 화면을 실시간 동시 편집(Yjs)과 잇는다.
// 보드의 요소(도형·글·선)는 Y.Map('elements') 에 요소 id 별로, 그림은 Y.Map('files') 에 둔다.
// 같은 요소를 여러 명이 고치면 version 이 큰 쪽이 이긴다 (Excalidraw 의 reconcile 규칙).

/* eslint-disable @typescript-eslint/no-explicit-any */
type Element = any;
type Api = any;

const LOCAL = 'local';
const SEND_INTERVAL_MS = 50;
const SNAPSHOT_DELAY_MS = 3000;
// 보드에 넣는 그림 하나의 최대 크기 (모두에게 전달되므로)
const MAX_FILE_BYTES = 2 * 1024 * 1024;

const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value));

interface Props {
  workspace: string;
  docId: number;
  me: IUser;
  readOnly: boolean;
  initialContent: string;
  dark: boolean;
}

const BoardEditor: FC<Props> = ({ workspace, docId, me, readOnly, initialContent, dark }) => {
  const { provider, synced, canEdit, status } = useCollab(workspace, docId, me);
  const [api, setApi] = useState<Api | null>(null);
  const editable = canEdit && !readOnly;
  // 지금 보드에 반영된 요소 버전 (내가 보낸 것·받은 것). 이것보다 새 버전만 보낸다
  const versionsRef = useRef(new Map<string, number>());
  const readyRef = useRef(false);
  const pendingRef = useRef(new Map<string, Element>());
  const sendTimerRef = useRef<number | null>(null);
  const snapshotTimerRef = useRef<number | null>(null);
  const selectionRef = useRef('');
  const pointerTimerRef = useRef(0);
  const initialRef = useRef(initialContent);
  // 처음 보여 줄 보드 내용. Excalidraw 는 처음 뜰 때 이 약속(Promise)이 풀리기를 기다린다
  // (뜨기 전에 updateScene 으로 넣으면 Excalidraw 의 초기화가 덮어써 빈 보드가 된다)
  const initialDataRef = useRef<{ promise: Promise<unknown>; resolve: (value: unknown) => void; done: boolean }>();
  if (!initialDataRef.current) {
    let resolve: (value: unknown) => void = () => undefined;
    const promise = new Promise((r) => {
      resolve = r;
    });
    initialDataRef.current = { promise, resolve, done: false };
  }
  // 초기화가 끝나기 전에 받은 다른 사람의 변경 (끝나면 반영)
  const queuedRef = useRef<Element[]>([]);

  // 보드와 공동 편집 상태 잇기 (처음 불러오기, 다른 사람이 고친 것 받기, 커서 보이기)
  useEffect(() => {
    if (!provider || !synced || !api) return undefined;
    const yElements = provider.doc.getMap<Element>('elements');
    const yFiles = provider.doc.getMap<any>('files');
    const versions = versionsRef.current;
    versions.clear();

    let elements: Element[] = Array.from(yElements.values());
    // 템플릿으로 만든 새 보드: 처음 연 사람이 템플릿 요소를 넣는다
    const template = parseBoardTemplate(initialRef.current);
    if (!elements.length && template && provider.canEdit) {
      elements = convertToExcalidrawElements(template as Element[], { regenerateIds: false });
      provider.doc.transact(() => elements.forEach((el) => yElements.set(el.id, clone(el))), LOCAL);
      // 검색·미리보기용 글도 바로 (템플릿 표시를 지워 다시 넣지 않게)
      provider.sendSnapshot(
        elements
          .filter((el) => el.type === 'text')
          .map((el) => el.text)
          .join('\n'),
      );
    }
    elements.forEach((el) => versions.set(el.id, el.version));
    const files = Array.from(yFiles.values());
    const initial = initialDataRef.current!;
    if (!initial.done) {
      initial.done = true;
      initial.resolve({
        elements,
        files: Object.fromEntries(files.map((f: any) => [f.id, f])),
        scrollToContent: elements.length > 0,
      });
    } else {
      // 다시 연결됐을 때: 지금 화면과 합친다
      api.updateScene({
        elements: reconcileElements(api.getSceneElementsIncludingDeleted(), elements, api.getAppState()),
        captureUpdate: CaptureUpdateAction.NEVER,
      });
      if (files.length) api.addFiles(files);
    }

    const onElements = (event: { keysChanged: Set<string> }, transaction: { origin: unknown }) => {
      if (transaction.origin === LOCAL) return;
      const remote = Array.from(event.keysChanged)
        .map((key) => yElements.get(key))
        .filter(Boolean);
      if (!remote.length) return;
      remote.forEach((el) => versions.set(el.id, Math.max(versions.get(el.id) ?? -1, el.version)));
      if (!readyRef.current) {
        queuedRef.current.push(...remote);
        return;
      }
      api.updateScene({
        elements: reconcileElements(api.getSceneElementsIncludingDeleted(), remote, api.getAppState()),
        captureUpdate: CaptureUpdateAction.NEVER,
      });
    };
    const onFiles = (event: { keysChanged: Set<string> }, transaction: { origin: unknown }) => {
      if (transaction.origin === LOCAL) return;
      const added = Array.from(event.keysChanged)
        .map((key) => yFiles.get(key))
        .filter(Boolean);
      if (added.length) api.addFiles(added);
    };
    // 다른 사람의 커서·선택
    const onAwareness = () => {
      const collaborators = new Map();
      provider.awareness.getStates().forEach((state: any, clientId: number) => {
        if (clientId === provider.doc.clientID || !state?.user) return;
        collaborators.set(String(clientId), {
          id: String(state.user.id),
          username: state.user.name,
          color: { background: state.user.color, stroke: state.user.color },
          pointer: state.pointer,
          button: state.button || 'up',
          selectedElementIds: state.selected || {},
        });
      });
      api.updateScene({ collaborators });
    };
    yElements.observe(onElements);
    yFiles.observe(onFiles);
    provider.awareness.on('change', onAwareness);
    onAwareness();
    return () => {
      readyRef.current = false;
      yElements.unobserve(onElements);
      yFiles.unobserve(onFiles);
      provider.awareness.off('change', onAwareness);
    };
  }, [provider, synced, api]);

  useEffect(
    () => () => {
      if (sendTimerRef.current) window.clearTimeout(sendTimerRef.current);
      if (snapshotTimerRef.current) window.clearTimeout(snapshotTimerRef.current);
    },
    [],
  );

  // 내가 고친 요소를 모아서 조금씩 보낸다 (끌기처럼 잦은 변경을 하나로)
  const flush = () => {
    sendTimerRef.current = null;
    if (!provider || !pendingRef.current.size) return;
    const yElements = provider.doc.getMap<Element>('elements');
    const changes = Array.from(pendingRef.current.values());
    pendingRef.current.clear();
    provider.doc.transact(() => changes.forEach((el) => yElements.set(el.id, el)), LOCAL);
  };

  const onChange = (elements: readonly Element[], appState: any, files: Record<string, any>) => {
    if (!provider || !initialDataRef.current?.done) return;
    if (!readyRef.current) {
      // 처음 내용이 화면에 올라온 뒤 첫 onChange: 이제부터 주고받는다
      readyRef.current = true;
      // 보드 전체가 한눈에 보이게
      const visible = elements.filter((el) => !el.isDeleted);
      if (visible.length && api) {
        api.scrollToContent(visible, { fitToViewport: true, viewportZoomFactor: 0.8, animate: false });
      }
      if (queuedRef.current.length && api) {
        const queued = queuedRef.current;
        queuedRef.current = [];
        api.updateScene({
          elements: reconcileElements(api.getSceneElementsIncludingDeleted(), queued, api.getAppState()),
          captureUpdate: CaptureUpdateAction.NEVER,
        });
      }
      return;
    }
    if (!editable) return;
    const versions = versionsRef.current;
    let changed = false;
    elements.forEach((el) => {
      if ((versions.get(el.id) ?? -1) < el.version) {
        versions.set(el.id, el.version);
        pendingRef.current.set(el.id, clone(el));
        changed = true;
      }
    });
    if (changed && !sendTimerRef.current) {
      sendTimerRef.current = window.setTimeout(flush, SEND_INTERVAL_MS);
    }
    // 새로 넣은 그림
    const yFiles = provider.doc.getMap<any>('files');
    Object.values(files || {}).forEach((file: any) => {
      if (!yFiles.has(file.id) && file.dataURL?.length <= MAX_FILE_BYTES * 1.4) {
        provider.doc.transact(() => yFiles.set(file.id, clone(file)), LOCAL);
      }
    });
    // 내 선택을 다른 사람에게
    const selected = JSON.stringify(appState.selectedElementIds || {});
    if (selected !== selectionRef.current) {
      selectionRef.current = selected;
      provider.awareness.setLocalStateField('selected', appState.selectedElementIds || {});
    }
    // 검색·미리보기용 글
    if (changed) {
      if (snapshotTimerRef.current) window.clearTimeout(snapshotTimerRef.current);
      snapshotTimerRef.current = window.setTimeout(() => {
        const text = elements
          .filter((el) => !el.isDeleted && el.type === 'text')
          .map((el) => el.text)
          .join('\n');
        provider.sendSnapshot(text);
      }, SNAPSHOT_DELAY_MS);
    }
  };

  const onPointerUpdate = ({
    pointer,
    button,
  }: {
    pointer: { x: number; y: number; tool: string };
    button: string;
  }) => {
    if (!provider) return;
    const now = Date.now();
    if (now - pointerTimerRef.current < 40) return;
    pointerTimerRef.current = now;
    provider.awareness.setLocalStateField('pointer', pointer);
    provider.awareness.setLocalStateField('button', button);
  };

  return (
    <BoardWrap aria-label="화이트보드" data-status={status}>
      {status !== 'synced' && (
        <div className={`board-status ${status}`} role="status">
          {status === 'connecting' && '보드를 불러오는 중…'}
          {status === 'offline' && '연결이 끊겼습니다. 다시 연결하는 중… (고친 내용은 연결되면 합쳐집니다)'}
          {status === 'error' && '이 보드를 열 수 없습니다.'}
        </div>
      )}
      <Excalidraw
        excalidrawAPI={setApi}
        initialData={initialDataRef.current.promise as any}
        onChange={onChange}
        onPointerUpdate={onPointerUpdate}
        viewModeEnabled={!editable}
        theme={dark ? 'dark' : 'light'}
        langCode="ko-KR"
        isCollaborating
        UIOptions={{
          canvasActions: {
            loadScene: false,
            saveToActiveFile: false,
            toggleTheme: false,
            export: false,
          },
        }}
      >
        <MainMenu>
          <MainMenu.DefaultItems.SaveAsImage />
          <MainMenu.DefaultItems.SearchMenu />
          <MainMenu.DefaultItems.Help />
          {editable && <MainMenu.DefaultItems.ClearCanvas />}
          <MainMenu.Separator />
          <MainMenu.DefaultItems.ChangeCanvasBackground />
        </MainMenu>
        <WelcomeScreen>
          <WelcomeScreen.Center>
            <WelcomeScreen.Center.Heading>
              포스트잇·도형·화살표로 함께 그려 보세요. 들어온 사람들의 커서가 함께 보여요.
            </WelcomeScreen.Center.Heading>
          </WelcomeScreen.Center>
          <WelcomeScreen.Hints.ToolbarHint />
          <WelcomeScreen.Hints.HelpHint />
        </WelcomeScreen>
      </Excalidraw>
    </BoardWrap>
  );
};

export default BoardEditor;
