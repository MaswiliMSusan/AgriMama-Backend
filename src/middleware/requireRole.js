export function requireRole(...allowedRoles) {
  return async function (request, reply) {
    if (!request.authUser) {
      return reply.code(401).send({
        success: false,
        message: "Authentication required.",
      });
    }

    if (!allowedRoles.includes(request.authUser.role)) {
      return reply.code(403).send({
        success: false,
        message: "You do not have permission to access this resource.",
      });
    }
  };
}