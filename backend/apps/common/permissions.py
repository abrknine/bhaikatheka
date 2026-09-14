from rest_framework import permissions


class IsOwner(permissions.BasePermission):
    """Object-level check for models with a `user` field."""

    message = "You do not own this object."

    def has_object_permission(self, request, view, obj) -> bool:
        return getattr(obj, "user_id", None) == request.user.id


class IsOwnerOrReadOnly(IsOwner):
    def has_object_permission(self, request, view, obj) -> bool:
        if request.method in permissions.SAFE_METHODS:
            return True
        return super().has_object_permission(request, view, obj)
