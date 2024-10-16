module.exports = {
    remote: {
        safeStorage: {
            isEncryptionAvailable: jest.fn(() => true),
            encryptString: jest.fn((string) => Buffer.from(string).toString('base64')),
            decryptString: jest.fn((encrypted) => Buffer.from(encrypted, 'base64').toString('utf-8')),
        },
    },
};