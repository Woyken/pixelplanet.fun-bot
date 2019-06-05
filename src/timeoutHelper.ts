export async function timeoutFor(ms: number) {
    const promise = new Promise<void>((resolve, reject) => {
        setTimeout(() => {
            resolve();
        }, ms);
    });
    return promise;
}

export async function waitForAnyKey(): Promise<void> {
    return new Promise<void>((resolve, reject) => {
        if (process.stdin.setRawMode) {
            process.stdin.setRawMode(true);
        }
        process.stdin.resume();
        process.stdin.on('data', () => {
            resolve();
        });
    });
}
