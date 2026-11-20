package minibank.minibank.users.dto;

import minibank.minibank.users.entity.Role;
import minibank.minibank.users.entity.UserStatus;

import java.time.Instant;
import java.util.UUID;

public record AdminUserResponse(
        UUID id,
        String firstName,
        String lastName,
        String email,
        String documentNumber,
        Role role,
        UserStatus status,
        Instant createdAt,
        Instant updatedAt
) {
}
