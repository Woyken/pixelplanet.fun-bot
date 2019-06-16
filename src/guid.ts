export class Guid {
    public static newGuid() {
        return 'xxxxxxxxxxxx4xxxyxxxxxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
            // tslint:disable-next-line: no-bitwise
            const r = (Math.random() * 16) | 0;
            // tslint:disable-next-line: no-bitwise
            const v = c === 'x' ? r : (r & 0x3) | 0x8;
            return v.toString(16);
        });
    }

    public static validateGuid(guid: string): boolean {
        const matched = guid.match(
            /^[0-9a-f]{8}[0-9a-f]{4}[0-9a-f]{4}[0-9a-f]{4}[0-9a-f]{12}$/i,
        );
        return matched !== null;
    }
}
