import { decryptString, encryptString } from "../src";

test('Encrypts string', () => {
    const test1 = `testValue`;
    console.log(decryptString(encryptString(test1)!));
});
