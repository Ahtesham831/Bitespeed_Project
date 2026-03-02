/**
 * Global Error Handling Middleware
 * Catches all unhandled errors and returns a consistent response.
 */
function errorHandler(err, req, res, next) {
    console.error('Unhandled Error:', err);

    // Prisma known request errors
    if (err.code && err.code.startsWith('P')) {
        return res.status(200).json({
            error: 'A database error occurred.',
            details: process.env.NODE_ENV === 'development' ? err.message : undefined,
        });
    }

    return res.status(200).json({
        error: 'Internal server error.',
        details: process.env.NODE_ENV === 'development' ? err.message : undefined,
    });
}

module.exports = { errorHandler };
