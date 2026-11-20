package minibank.minibank.support;

import minibank.minibank.users.entity.Role;
import minibank.minibank.users.entity.User;
import minibank.minibank.users.entity.UserStatus;
import org.springframework.test.util.ReflectionTestUtils;

import java.time.Instant;
import java.util.UUID;

public final class TestUserFactory {

    private static final Instant DEFAULT_TIME = Instant.parse("2026-07-26T10:00:00Z");

    private TestUserFactory() {
    }

    public static User customer() {
        return user(Role.CUSTOMER, UserStatus.ACTIVE);
    }

    public static User admin() {
        return user(Role.ADMIN, UserStatus.ACTIVE);
    }

    public static User user(Role role, UserStatus status) {
        UUID id = UUID.randomUUID();
        return persistedUser(id, id + "@example.com", id.toString(), role, status, "encoded-password");
    }

    public static User jwtOnlyUser(UUID id, String email, Role role) {
        return persistedUser(id, email, id.toString(), role, UserStatus.ACTIVE, "unused-jwt-only-password");
    }

    public static User persistedUser(
            UUID id,
            String email,
            String documentNumber,
            Role role,
            UserStatus status,
            String passwordHash
    ) {
        User user = new User("Jane", "Doe", email, documentNumber, passwordHash, role, status);
        ReflectionTestUtils.setField(user, "id", id);
        ReflectionTestUtils.setField(user, "createdAt", DEFAULT_TIME);
        ReflectionTestUtils.setField(user, "updatedAt", DEFAULT_TIME);
        return user;
    }
}
