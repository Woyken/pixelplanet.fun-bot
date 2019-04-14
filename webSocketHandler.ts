import WebSocket from "ws";

export class WebSocketHandler {

    public onPixelUpdate?: (xChunk: number, yChunk: number, pixelIdInChunk: number, color: number) => void;

    private webSocket?: WebSocket;
    private fingerprint: string;
    private watchingChunks: number[] = [];

    constructor(fingerprint: string) {
        this.fingerprint = fingerprint;
    }

    public connect() {
        this.webSocket = new WebSocket(`wss://pixelplanet.fun/ws?fingerprint=${this.fingerprint}`);
        this.webSocket.binaryType = "arraybuffer";
        this.webSocket.onopen = this.onOpen.bind(this);
        this.webSocket.onmessage = this.onMessage.bind(this);
        this.webSocket.onclose = this.onClose.bind(this);
        this.webSocket.onerror = this.onError.bind(this);
    }

    public watchChunk(chunkId: number) {
        chunkId = ((chunkId % 256) * 256 + (Math.floor(chunkId / 256)));
        console.log("watch chunk" + chunkId);
        const buffer = new ArrayBuffer(1 + 2);
        const view = new DataView(buffer);
        view.setInt8(0, 0xA1);
        view.setInt16(1, chunkId);
        if (this.webSocket && this.webSocket.readyState === WebSocket.OPEN) {
            this.webSocket.send(buffer);
        }

        if (this.watchingChunks.findIndex((v) => v === chunkId) < 0) {
            this.watchingChunks.push(chunkId);
        }
    }

    private onOpen() {
        // tslint:disable-next-line: no-console
        console.log(`Starting listening for changes via websocket`);
        this.watchingChunks.forEach((c) => this.watchChunk(c));
    }

    private onMessage(ev: { data: any; type: string; target: WebSocket; }) {
        const buffer = ev.data as Buffer;
        if (buffer.byteLength === 0) {
            return;
        }
        const data = new DataView(buffer);
        const opcode = data.getUint8(0);

        switch (opcode) {
          case 0xC1: // PIXEL UPDATE
            const chunkX = data.getInt16(1);
            const chunkY = data.getInt16(3);
            const pixelIdInChunk = data.getUint16(5);

            const color = data.getUint8(7);
            if (this.onPixelUpdate) {
                this.onPixelUpdate(chunkX, chunkY, pixelIdInChunk, color);
            }
            break;
          default:
            break;
        }
    }

    private onClose(e: any) {
        // tslint:disable-next-line: no-console
        console.warn("Socket is closed. " + "Reconnect will be attempted in 1 second.", e.reason);
        setTimeout(() => this.connect(), 1000);
    }

    private onError(err: any) {
        // tslint:disable-next-line: no-console
        console.error(`Socket encountered error, closing socket`, err);
        this.webSocket!.close();
    }
}
