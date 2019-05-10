export async function timeoutFor(ms: number) {
    const promise = new Promise<void>((resolve, reject) => {
        setTimeout(() => {
            resolve();
        },         ms);
    });
    return promise;
}
