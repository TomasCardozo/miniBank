package minibank.minibank.auth.dto;

import minibank.minibank.users.entity.Role;
import minibank.minibank.users.entity.UserStatus;

import java.time.Instant;
import java.util.UUID;

public record AuthUserResponse(
        UUID id,
        String firstName,
        String lastName,
        String email,
        Role role,
        UserStatus status,
        Instant createdAt
) {
}
