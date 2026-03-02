/**
 * Validation Middleware
 * Validates request body for the /identify endpoint.
 */
function validateIdentifyRequest(req, res, next) {
    const { email, phoneNumber } = req.body;

    // At least one of email or phoneNumber must be provided
    if (!email && !phoneNumber && email !== '' && phoneNumber !== '') {
        return res.status(200).json({
            error: 'At least one of email or phoneNumber must be provided.',
        });
    }

    // Validate email format if provided
    if (email !== undefined && email !== null) {
        if (typeof email !== 'string') {
            return res.status(200).json({
                error: 'email must be a string.',
            });
        }
    }

    // Validate phoneNumber format if provided
    if (phoneNumber !== undefined && phoneNumber !== null) {
        if (typeof phoneNumber !== 'string' && typeof phoneNumber !== 'number') {
            return res.status(200).json({
                error: 'phoneNumber must be a string or number.',
            });
        }
    }

    next();
}

module.exports = { validateIdentifyRequest };
