package minibank.minibank.auth.service;

import minibank.minibank.users.entity.Role;
import minibank.minibank.users.entity.User;
import minibank.minibank.users.entity.UserStatus;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class JwtServiceTest {

    private static final String SECRET = "test-secret-change-before-real-use";
    private static final long EXPIRATION_MILLIS = 3600000L;
    private static final Instant NOW = Instant.parse("2099-07-26T10:00:00Z");

    @Test
    void generateTokenIncludesExpectedClaims() {
        JwtService jwtService = jwtService();
        User user = user();

        String token = jwtService.generateToken(user);

        var claims = jwtService.parseClaims(token).orElseThrow();
        assertThat(claims.getSubject()).isEqualTo(user.getEmail());
        assertThat(claims.get("userId", String.class)).isEqualTo(user.getId().toString());
        assertThat(claims.get("role", String.class)).isEqualTo(Role.CUSTOMER.name());
        assertThat(claims.getIssuedAt().toInstant()).isEqualTo(NOW);
        assertThat(claims.getExpiration().toInstant()).isEqualTo(NOW.plusMillis(EXPIRATION_MILLIS));
    }

    @Test
    void extractsEmailUserIdAndRole() {
        JwtService jwtService = jwtService();
        User user = user();

        String token = jwtService.generateToken(user);

        assertThat(jwtService.extractEmail(token)).contains(user.getEmail());
        assertThat(jwtService.extractUserId(token)).contains(user.getId());
        assertThat(jwtService.extractRole(token)).contains(Role.CUSTOMER);
    }

    @Test
    void invalidTokenReturnsEmptyValues() {
        JwtService jwtService = jwtService();

        assertThat(jwtService.parseClaims("not-a-jwt")).isEmpty();
        assertThat(jwtService.extractEmail("not-a-jwt")).isEmpty();
        assertThat(jwtService.extractUserId("not-a-jwt")).isEmpty();
        assertThat(jwtService.extractRole("not-a-jwt")).isEmpty();
    }

    @Test
    void expiredTokenReturnsEmptyClaims() {
        JwtService expiredTokenIssuer = new JwtService(
                SECRET,
                1000L,
                Clock.fixed(Instant.parse("2000-01-01T00:00:00Z"), ZoneOffset.UTC)
        );

        String token = expiredTokenIssuer.generateToken(user());

        assertThat(jwtService().parseClaims(token)).isEmpty();
    }

    @Test
    void tokenSignedWithDifferentSecretReturnsEmptyClaims() {
        JwtService otherIssuer = new JwtService(
                "different-secret-change-before-real-use",
                EXPIRATION_MILLIS,
                Clock.fixed(NOW, ZoneOffset.UTC)
        );

        String token = otherIssuer.generateToken(user());

        assertThat(jwtService().parseClaims(token)).isEmpty();
    }

    @Test
    void exposesConfiguredExpirationMillis() {
        assertThat(jwtService().getExpirationMillis()).isEqualTo(EXPIRATION_MILLIS);
    }

    @Test
    void rejectsPlaceholderSecretWhenValidationIsRequired() {
        assertThatThrownBy(() -> new JwtService(
                "change-me-to-a-long-random-secret-before-real-use",
                EXPIRATION_MILLIS,
                Clock.fixed(NOW, ZoneOffset.UTC),
                true
        ))
                .isInstanceOf(IllegalStateException.class)
                .hasMessage("JWT secret must be a strong external secret");
    }

    @Test
    void rejectsShortSecretWhenValidationIsRequired() {
        assertThatThrownBy(() -> new JwtService(
                "short-secret",
                EXPIRATION_MILLIS,
                Clock.fixed(NOW, ZoneOffset.UTC),
                true
        ))
                .isInstanceOf(IllegalStateException.class)
                .hasMessage("JWT secret must be a strong external secret");
    }

    @Test
    void acceptsStrongSecretWhenValidationIsRequired() {
        JwtService jwtService = new JwtService(
                "strong-external-secret-with-enough-entropy-123456",
                EXPIRATION_MILLIS,
                Clock.fixed(NOW, ZoneOffset.UTC),
                true
        );

        assertThat(jwtService.generateToken(user())).isNotBlank();
    }

    private JwtService jwtService() {
        return new JwtService(SECRET, EXPIRATION_MILLIS, Clock.fixed(NOW, ZoneOffset.UTC));
    }

    private User user() {
        User user = new User(
                "Jane",
                "Doe",
                "user@example.com",
                "12345678",
                "hashed-password",
                Role.CUSTOMER,
                UserStatus.ACTIVE
        );
        ReflectionTestUtils.setField(user, "id", UUID.randomUUID());
        return user;
    }
}
