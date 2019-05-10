import ws from 'ws';
import logger from './logger';

export class WebSocketHandler {

    public onPixelUpdate?: (xChunk: number,
                            yChunk: number,
                            pixelIdInChunk: number,
                            color: number) => void;

    private webSocket?: ws;
    private fingerprint: string;
    private watchingChunks: number[] = [];
    private retryTimerId?: NodeJS.Timeout;

    constructor(fingerprint: string) {
        this.fingerprint = fingerprint;
    }

    public connect() {
        // Continuously retry connection.
        if (!this.retryTimerId) {
            this.retryTimerId = setInterval(() => {
                if (this.webSocket &&
                    (this.webSocket.readyState === ws.CONNECTING ||
                        this.webSocket.readyState === ws.OPEN)) {
                    return;
                }
                this.connect();
            },                              5000);
        }
        this.webSocket = undefined;
        this.webSocket = new ws(`wss://pixelplanet.fun/ws?fingerprint=${this.fingerprint}`,
                                { origin: 'https://pixelpixel.fun' });
        this.webSocket.binaryType = 'arraybuffer';
        this.webSocket.onopen = this.onOpen.bind(this);
        this.webSocket.onmessage = this.onMessage.bind(this);
        this.webSocket.onclose = this.onClose.bind(this);
        this.webSocket.onerror = this.onError.bind(this);
    }

    public watchChunk(chunkId: number) {
        const buffer = new ArrayBuffer(1 + 2);
        const view = new DataView(buffer);
        view.setInt8(0, 0xA1);
        view.setInt16(1, chunkId);
        if (this.webSocket && this.webSocket.readyState === ws.OPEN) {
            this.webSocket.send(buffer);
        }

        if (this.watchingChunks.findIndex((v) => {
            return v === chunkId;
        }) < 0) {
            this.watchingChunks.push(chunkId);
        }
    }

    private onOpen() {
        if (this.retryTimerId) {
            clearInterval(this.retryTimerId);
            this.retryTimerId = undefined;
        }
        logger.log('Starting listening for changes via websocket');
        this.watchingChunks.forEach((c) => {
            return this.watchChunk(c);
        });
    }

    private onMessage(ev: { data: any; type: string; target: ws; }) {
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

    private onClose(event: {wasClean: boolean, code: number, reason: string, target: ws}) {
        this.webSocket = undefined;
        logger.logWarn(`Socket was closed. Reconnecting... ${event.reason}`);
        this.connect();
    }

    private onError(event: {error: any, message: string, type: string, target: ws}) {
        logger.logError(`Socket encountered error, closing socket ${event.message}`);
        event.target.close();
    }
}
