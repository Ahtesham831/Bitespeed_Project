const prisma = require('../config/database');

/**
 * Contact Model - Data Access Layer
 * Handles all database operations for the Contact entity.
 */
class ContactModel {
    /**
     * Find all contacts matching the given email or phoneNumber.
     * @param {string|null} email
     * @param {string|null} phoneNumber
     * @returns {Promise<Array>} matching contacts
     */
    static async findByEmailOrPhone(email, phoneNumber) {
        const conditions = [];
        if (email) conditions.push({ email });
        if (phoneNumber) conditions.push({ phoneNumber });

        if (conditions.length === 0) return [];

        return prisma.contact.findMany({
            where: {
                deletedAt: null,
                OR: conditions,
            },
            orderBy: { createdAt: 'asc' },
        });
    }

    /**
     * Find a contact by its ID.
     * @param {number} id
     * @returns {Promise<Object|null>}
     */
    static async findById(id) {
        return prisma.contact.findUnique({
            where: { id },
        });
    }

    /**
     * Find all contacts linked to the given primary contact ID.
     * @param {number} primaryId
     * @returns {Promise<Array>}
     */
    static async findAllSecondaries(primaryId) {
        return prisma.contact.findMany({
            where: {
                linkedId: primaryId,
                deletedAt: null,
            },
            orderBy: { createdAt: 'asc' },
        });
    }

    /**
     * Find all contacts in a cluster given a set of primary IDs.
     * This fetches all primaries + all their secondaries in ONE query.
     * @param {number[]} primaryIds
     * @returns {Promise<Array>}
     */
    static async findEntireCluster(primaryIds) {
        return prisma.contact.findMany({
            where: {
                deletedAt: null,
                OR: [
                    { id: { in: primaryIds } },
                    { linkedId: { in: primaryIds } },
                ],
            },
            orderBy: { createdAt: 'asc' },
        });
    }

    /**
     * Create a new contact (primary or secondary).
     * @param {Object} data
     * @returns {Promise<Object>}
     */
    static async create(data) {
        return prisma.contact.create({ data });
    }

    /**
     * Update a contact by its ID.
     * @param {number} id
     * @param {Object} data
     * @returns {Promise<Object>}
     */
    static async update(id, data) {
        return prisma.contact.update({
            where: { id },
            data: { ...data, updatedAt: new Date() },
        });
    }

    /**
     * Update multiple contacts' linkedId in a single query (for merging).
     * @param {number[]} ids
     * @param {number} newLinkedId
     * @returns {Promise<Object>}
     */
    static async updateManyLinkedId(ids, newLinkedId) {
        return prisma.contact.updateMany({
            where: { id: { in: ids } },
            data: {
                linkedId: newLinkedId,
                linkPrecedence: 'secondary',
                updatedAt: new Date(),
            },
        });
    }

    /**
     * Re-link all secondaries from one primary to another primary.
     * @param {number} oldPrimaryId
     * @param {number} newPrimaryId
     * @returns {Promise<Object>}
     */
    static async relinkSecondaries(oldPrimaryId, newPrimaryId) {
        return prisma.contact.updateMany({
            where: {
                linkedId: oldPrimaryId,
                deletedAt: null,
            },
            data: {
                linkedId: newPrimaryId,
                updatedAt: new Date(),
            },
        });
    }

    /**
     * Execute operations within a Prisma transaction.
     * @param {Function} fn - async function receiving prisma transaction client
     * @returns {Promise<any>}
     */
    static async transaction(fn) {
        return prisma.$transaction(fn);
    }
}

module.exports = ContactModel;
