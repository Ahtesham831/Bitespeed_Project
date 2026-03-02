const prisma = require('../config/database');

/**
 * Identity Service - Core Business Logic
 * Handles all identity reconciliation logic including:
 *  - Creating new primary contacts
 *  - Creating secondary contacts for new info
 *  - Merging two primaries
 *  - Handling exact duplicates
 */
class IdentityService {
    /**
     * Main entry point: identify a contact by email and/or phoneNumber.
     * @param {string|null} email
     * @param {string|null} phoneNumber
     * @returns {Promise<Object>} consolidated contact response
     */
    static async identify(email, phoneNumber) {
        // Normalize inputs
        email = email || null;
        phoneNumber = phoneNumber ? String(phoneNumber) : null;

        // Use a transaction for data consistency
        return prisma.$transaction(async (tx) => {
            // Step 1: Find all contacts matching email or phoneNumber
            const matchingContacts = await this._findMatchingContacts(tx, email, phoneNumber);

            // Case 1: No existing contact — create new primary
            if (matchingContacts.length === 0) {
                const newContact = await tx.contact.create({
                    data: {
                        email,
                        phoneNumber,
                        linkPrecedence: 'primary',
                    },
                });
                return this._formatResponse(newContact, []);
            }

            // Step 2: Resolve all primary IDs from matching contacts
            const primaryIds = new Set();
            for (const contact of matchingContacts) {
                if (contact.linkPrecedence === 'primary') {
                    primaryIds.add(contact.id);
                } else if (contact.linkedId) {
                    primaryIds.add(contact.linkedId);
                }
            }

            // Step 3: Fetch the entire cluster (all primaries + all their secondaries)
            const allClusterContacts = await tx.contact.findMany({
                where: {
                    deletedAt: null,
                    OR: [
                        { id: { in: Array.from(primaryIds) } },
                        { linkedId: { in: Array.from(primaryIds) } },
                    ],
                },
                orderBy: { createdAt: 'asc' },
            });

            // Step 4: Identify all primary contacts in the cluster
            let primaries = allClusterContacts.filter(c => c.linkPrecedence === 'primary');
            primaries.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));

            // Case 3: Two or more primaries need merging
            if (primaries.length > 1) {
                const truePrimary = primaries[0]; // oldest
                const otherPrimaries = primaries.slice(1);
                const otherPrimaryIds = otherPrimaries.map(p => p.id);

                // Convert other primaries to secondaries
                await tx.contact.updateMany({
                    where: { id: { in: otherPrimaryIds } },
                    data: {
                        linkedId: truePrimary.id,
                        linkPrecedence: 'secondary',
                        updatedAt: new Date(),
                    },
                });

                // Re-link all secondaries of other primaries to the true primary
                await tx.contact.updateMany({
                    where: {
                        linkedId: { in: otherPrimaryIds },
                        deletedAt: null,
                    },
                    data: {
                        linkedId: truePrimary.id,
                        updatedAt: new Date(),
                    },
                });
            }

            // Step 5: Re-fetch the cluster after potential merge
            const truePrimaryId = primaries[0].id;
            let updatedCluster = await tx.contact.findMany({
                where: {
                    deletedAt: null,
                    OR: [
                        { id: truePrimaryId },
                        { linkedId: truePrimaryId },
                    ],
                },
                orderBy: { createdAt: 'asc' },
            });

            const primaryContact = updatedCluster.find(c => c.id === truePrimaryId);
            const secondaries = updatedCluster.filter(c => c.id !== truePrimaryId);

            // Step 6: Check if this is a new piece of info — Case 2
            const existingEmails = new Set(updatedCluster.map(c => c.email).filter(Boolean));
            const existingPhones = new Set(updatedCluster.map(c => c.phoneNumber).filter(Boolean));

            const isNewEmail = email && !existingEmails.has(email);
            const isNewPhone = phoneNumber && !existingPhones.has(phoneNumber);

            // Case 4: Exact duplicate — both email and phone already in cluster
            if (!isNewEmail && !isNewPhone) {
                return this._formatResponse(primaryContact, secondaries);
            }

            // Case 2: New info — create a secondary contact
            const newSecondary = await tx.contact.create({
                data: {
                    email,
                    phoneNumber,
                    linkedId: truePrimaryId,
                    linkPrecedence: 'secondary',
                },
            });

            secondaries.push(newSecondary);

            return this._formatResponse(primaryContact, secondaries);
        }, {
            isolationLevel: 'Serializable', // Prevent race conditions
        });
    }

    /**
     * Find contacts matching email or phoneNumber.
     * @private
     */
    static async _findMatchingContacts(tx, email, phoneNumber) {
        const conditions = [];
        if (email) conditions.push({ email });
        if (phoneNumber) conditions.push({ phoneNumber });

        if (conditions.length === 0) return [];

        return tx.contact.findMany({
            where: {
                deletedAt: null,
                OR: conditions,
            },
            orderBy: { createdAt: 'asc' },
        });
    }

    /**
     * Format the consolidated response.
     * @private
     */
    static _formatResponse(primaryContact, secondaries) {
        // Collect emails: primary first, then secondaries in order, no duplicates
        const emails = [];
        const emailSet = new Set();

        if (primaryContact.email) {
            emails.push(primaryContact.email);
            emailSet.add(primaryContact.email);
        }
        for (const sec of secondaries) {
            if (sec.email && !emailSet.has(sec.email)) {
                emails.push(sec.email);
                emailSet.add(sec.email);
            }
        }

        // Collect phone numbers: primary first, then secondaries in order, no duplicates
        const phoneNumbers = [];
        const phoneSet = new Set();

        if (primaryContact.phoneNumber) {
            phoneNumbers.push(primaryContact.phoneNumber);
            phoneSet.add(primaryContact.phoneNumber);
        }
        for (const sec of secondaries) {
            if (sec.phoneNumber && !phoneSet.has(sec.phoneNumber)) {
                phoneNumbers.push(sec.phoneNumber);
                phoneSet.add(sec.phoneNumber);
            }
        }

        // Collect secondary IDs
        const secondaryContactIds = secondaries.map(s => s.id);

        return {
            contact: {
                primaryContactId: primaryContact.id,
                emails,
                phoneNumbers,
                secondaryContactIds,
            },
        };
    }
}

module.exports = IdentityService;
