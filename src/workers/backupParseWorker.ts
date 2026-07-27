interface StartMessage {
  type: 'start';
  file: File;
}

interface NextMessage {
  type: 'next';
}

type WorkerRequest = StartMessage | NextMessage;

type WorkerResponse =
  | { type: 'ready'; total: number }
  | { type: 'pack'; value: unknown }
  | { type: 'done' }
  | { type: 'error'; message: string };

const workerScope = self as unknown as {
  onmessage: ((event: MessageEvent<WorkerRequest>) => void) | null;
  postMessage: (message: WorkerResponse) => void;
};

let packs: unknown[] = [];
let index = 0;

function sendNext() {
  if (index >= packs.length) {
    packs = [];
    index = 0;
    workerScope.postMessage({ type: 'done' });
    return;
  }
  workerScope.postMessage({ type: 'pack', value: packs[index] });
  index += 1;
}

workerScope.onmessage = event => {
  const message = event.data;
  if (message.type === 'next') {
    sendNext();
    return;
  }

  void (async () => {
    try {
      const text = await message.file.text();
      const parsed: unknown = JSON.parse(text);
      packs = Array.isArray(parsed) ? parsed : [parsed];
      index = 0;
      workerScope.postMessage({ type: 'ready', total: packs.length });
      sendNext();
    } catch (error) {
      workerScope.postMessage({
        type: 'error',
        message: error instanceof Error ? error.message : String(error)
      });
    }
  })();
};

export {};
