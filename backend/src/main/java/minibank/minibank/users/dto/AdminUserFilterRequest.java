package minibank.minibank.users.dto;

import minibank.minibank.users.entity.Role;
import minibank.minibank.users.entity.UserStatus;

public record AdminUserFilterRequest(
        Role role,
        UserStatus status
) {
}
