const IdentityService = require('../services/identity.service');

/**
 * Identity Controller
 * Handles the POST /identify request.
 */
class IdentityController {
    /**
     * POST /identify
     * Identifies and consolidates a contact based on email and/or phoneNumber.
     */
    static async identify(req, res, next) {
        try {
            const { email, phoneNumber } = req.body;
            const result = await IdentityService.identify(email, phoneNumber);
            return res.status(200).json(result);
        } catch (error) {
            next(error);
        }
    }
}

module.exports = IdentityController;
