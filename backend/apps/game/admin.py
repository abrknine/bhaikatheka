from django.contrib import admin

from .models import GameSession


@admin.register(GameSession)
class GameSessionAdmin(admin.ModelAdmin):
    list_display = ["user", "jars", "litres_drunk", "litres_spilled", "created_at"]
    list_filter = ["created_at"]
    search_fields = ["user__email", "user__display_name"]
    readonly_fields = ["id", "created_at", "updated_at"]
    list_select_related = ["user"]
    date_hierarchy = "created_at"
