export class Guid {
    public static newGuid() {
        return 'xxxxxxxxxxxx4xxxyxxxxxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
            // tslint:disable-next-line: no-bitwise
            const r = Math.random() * 16 | 0;
            // tslint:disable-next-line: no-bitwise
            const v = c === 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    }
}
