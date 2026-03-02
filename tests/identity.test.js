const request = require('supertest');
const app = require('../src/app');

// Mock Prisma client
jest.mock('../src/config/database', () => {
    const contacts = [];
    let idCounter = 1;

    /**
     * Check if a single contact matches an OR condition object.
     */
    function matchesCondition(contact, cond) {
        // { email: "value" }
        if (cond.email !== undefined && contact.email === cond.email) return true;
        // { phoneNumber: "value" }
        if (cond.phoneNumber !== undefined && contact.phoneNumber === cond.phoneNumber) return true;
        // { id: 5 } (direct equality)
        if (cond.id !== undefined && typeof cond.id === 'number' && contact.id === cond.id) return true;
        // { id: { in: [1,2,3] } }
        if (cond.id !== undefined && typeof cond.id === 'object' && cond.id.in && cond.id.in.includes(contact.id)) return true;
        // { linkedId: 5 } (direct equality)
        if (cond.linkedId !== undefined && typeof cond.linkedId === 'number' && contact.linkedId === cond.linkedId) return true;
        // { linkedId: { in: [1,2,3] } }
        if (cond.linkedId !== undefined && typeof cond.linkedId === 'object' && cond.linkedId.in && cond.linkedId.in.includes(contact.linkedId)) return true;
        return false;
    }

    const mockPrisma = {
        contact: {
            findMany: jest.fn(async ({ where, orderBy }) => {
                let results = contacts.filter(c => c.deletedAt === null);

                if (where.OR) {
                    results = results.filter(c => where.OR.some(cond => matchesCondition(c, cond)));
                }

                // Top-level linkedId filter (for relinkSecondaries)
                if (where.linkedId && !where.OR) {
                    if (typeof where.linkedId === 'object' && where.linkedId.in) {
                        results = results.filter(c => where.linkedId.in.includes(c.linkedId));
                    } else if (typeof where.linkedId === 'number') {
                        results = results.filter(c => c.linkedId === where.linkedId);
                    }
                }

                results.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
                return results;
            }),

            create: jest.fn(async ({ data }) => {
                const newContact = {
                    id: idCounter++,
                    phoneNumber: data.phoneNumber || null,
                    email: data.email || null,
                    linkedId: data.linkedId || null,
                    linkPrecedence: data.linkPrecedence || 'primary',
                    createdAt: new Date(),
                    updatedAt: new Date(),
                    deletedAt: null,
                };
                contacts.push(newContact);
                return newContact;
            }),

            updateMany: jest.fn(async ({ where, data }) => {
                let count = 0;
                contacts.forEach(c => {
                    if (c.deletedAt !== null) return;

                    let match = false;

                    // { id: { in: [...] } }
                    if (where.id && where.id.in && where.id.in.includes(c.id)) match = true;

                    // { linkedId: ... }
                    if (where.linkedId) {
                        if (typeof where.linkedId === 'object' && where.linkedId.in) {
                            if (where.linkedId.in.includes(c.linkedId)) match = true;
                        } else if (typeof where.linkedId === 'number') {
                            if (c.linkedId === where.linkedId) match = true;
                        }
                    }

                    if (match) {
                        if (data.linkedId !== undefined) c.linkedId = data.linkedId;
                        if (data.linkPrecedence !== undefined) c.linkPrecedence = data.linkPrecedence;
                        if (data.updatedAt !== undefined) c.updatedAt = data.updatedAt;
                        count++;
                    }
                });
                return { count };
            }),

            findUnique: jest.fn(async ({ where }) => {
                return contacts.find(c => c.id === where.id) || null;
            }),
        },

        $transaction: jest.fn(async (fn) => {
            // The service passes options as second arg to $transaction, our mock just ignores it
            return fn(mockPrisma);
        }),

        $connect: jest.fn(),
        $disconnect: jest.fn(),
    };

    // Expose for test cleanup
    mockPrisma._contacts = contacts;
    mockPrisma._resetDb = () => {
        contacts.length = 0;
        idCounter = 1;
    };

    return mockPrisma;
});

const prisma = require('../src/config/database');

describe('POST /identify', () => {
    beforeEach(() => {
        prisma._resetDb();
        jest.clearAllMocks();
    });

    // ===== CASE 1: No existing contact =====
    describe('Case 1: No existing contact', () => {
        it('should create a new primary contact when no match exists', async () => {
            const res = await request(app)
                .post('/identify')
                .send({ email: 'new@example.com', phoneNumber: '9999999999' });

            expect(res.status).toBe(200);
            expect(res.body.contact).toBeDefined();
            expect(res.body.contact.primaryContactId).toBe(1);
            expect(res.body.contact.emails).toContain('new@example.com');
            expect(res.body.contact.phoneNumbers).toContain('9999999999');
            expect(res.body.contact.secondaryContactIds).toEqual([]);
        });

        it('should create a primary contact with only email', async () => {
            const res = await request(app)
                .post('/identify')
                .send({ email: 'solo@example.com' });

            expect(res.status).toBe(200);
            expect(res.body.contact.emails).toContain('solo@example.com');
            expect(res.body.contact.phoneNumbers).toEqual([]);
            expect(res.body.contact.secondaryContactIds).toEqual([]);
        });

        it('should create a primary contact with only phoneNumber', async () => {
            const res = await request(app)
                .post('/identify')
                .send({ phoneNumber: '1111111111' });

            expect(res.status).toBe(200);
            expect(res.body.contact.phoneNumbers).toContain('1111111111');
            expect(res.body.contact.emails).toEqual([]);
            expect(res.body.contact.secondaryContactIds).toEqual([]);
        });
    });

    // ===== CASE 2: Matching contact, new info -> create secondary =====
    describe('Case 2: Matching contact with new info', () => {
        it('should create a secondary contact when new phone is provided for existing email', async () => {
            await request(app)
                .post('/identify')
                .send({ email: 'user@example.com', phoneNumber: '1234567890' });

            const res = await request(app)
                .post('/identify')
                .send({ email: 'user@example.com', phoneNumber: '0987654321' });

            expect(res.status).toBe(200);
            expect(res.body.contact.primaryContactId).toBe(1);
            expect(res.body.contact.emails).toContain('user@example.com');
            expect(res.body.contact.phoneNumbers).toContain('1234567890');
            expect(res.body.contact.phoneNumbers).toContain('0987654321');
            expect(res.body.contact.secondaryContactIds.length).toBeGreaterThanOrEqual(1);
        });

        it('should create a secondary contact when new email is provided for existing phone', async () => {
            await request(app)
                .post('/identify')
                .send({ email: 'a@example.com', phoneNumber: '5555555555' });

            const res = await request(app)
                .post('/identify')
                .send({ email: 'b@example.com', phoneNumber: '5555555555' });

            expect(res.status).toBe(200);
            expect(res.body.contact.primaryContactId).toBe(1);
            expect(res.body.contact.emails).toContain('a@example.com');
            expect(res.body.contact.emails).toContain('b@example.com');
            expect(res.body.contact.secondaryContactIds.length).toBeGreaterThanOrEqual(1);
        });
    });

    // ===== CASE 3: Two primaries -> merge =====
    describe('Case 3: Merging two primary contacts', () => {
        it('should merge two primaries when email matches one and phone matches another', async () => {
            await request(app)
                .post('/identify')
                .send({ email: 'alice@example.com', phoneNumber: '1111111111' });

            await request(app)
                .post('/identify')
                .send({ email: 'bob@example.com', phoneNumber: '2222222222' });

            const res = await request(app)
                .post('/identify')
                .send({ email: 'alice@example.com', phoneNumber: '2222222222' });

            expect(res.status).toBe(200);
            expect(res.body.contact.primaryContactId).toBe(1);
            expect(res.body.contact.emails).toContain('alice@example.com');
            expect(res.body.contact.emails).toContain('bob@example.com');
            expect(res.body.contact.phoneNumbers).toContain('1111111111');
            expect(res.body.contact.phoneNumbers).toContain('2222222222');
            expect(res.body.contact.secondaryContactIds).toContain(2);
        });
    });

    // ===== CASE 4: Exact duplicate =====
    describe('Case 4: Exact duplicate request', () => {
        it('should not create a new row for exact duplicate', async () => {
            await request(app)
                .post('/identify')
                .send({ email: 'dup@example.com', phoneNumber: '7777777777' });

            const res = await request(app)
                .post('/identify')
                .send({ email: 'dup@example.com', phoneNumber: '7777777777' });

            expect(res.status).toBe(200);
            expect(res.body.contact.primaryContactId).toBe(1);
            expect(res.body.contact.secondaryContactIds).toEqual([]);
            expect(prisma._contacts.length).toBe(1);
        });
    });

    // ===== Validation =====
    describe('Validation', () => {
        it('should return error if neither email nor phoneNumber is provided', async () => {
            const res = await request(app)
                .post('/identify')
                .send({});

            expect(res.status).toBe(200);
            expect(res.body.error).toBeDefined();
        });
    });
});

describe('GET /health', () => {
    it('should return health status', async () => {
        const res = await request(app).get('/health');
        expect(res.status).toBe(200);
        expect(res.body.status).toBe('ok');
    });
});
