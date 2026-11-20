package minibank.minibank.auth.service;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.JwtException;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import minibank.minibank.users.entity.Role;
import minibank.minibank.users.entity.User;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.env.Environment;
import org.springframework.stereotype.Service;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Clock;
import java.time.Instant;
import java.util.Arrays;
import java.util.Date;
import java.util.Optional;
import java.util.UUID;

@Service
public class JwtService {

    private static final int MIN_SECRET_LENGTH = 32;

    private final SecretKey signingKey;
    private final long expirationMillis;
    private final Clock clock;

    @Autowired
    public JwtService(
            @Value("${minibank.jwt.secret}") String secret,
            @Value("${minibank.jwt.expiration}") long expirationMillis,
            Environment environment
    ) {
        this(secret, expirationMillis, Clock.systemUTC(), shouldValidateSecret(environment));
    }

    JwtService(String secret, long expirationMillis, Clock clock) {
        this(secret, expirationMillis, clock, false);
    }

    JwtService(String secret, long expirationMillis, Clock clock, boolean validateSecret) {
        if (validateSecret) {
            validateSecret(secret);
        }
        this.signingKey = Keys.hmacShaKeyFor(sha256(secret));
        this.expirationMillis = expirationMillis;
        this.clock = clock;
    }

    public String generateToken(User user) {
        Instant now = clock.instant();
        Instant expiresAt = now.plusMillis(expirationMillis);

        return Jwts.builder()
                .subject(user.getEmail())
                .claim("userId", user.getId().toString())
                .claim("role", user.getRole().name())
                .issuedAt(Date.from(now))
                .expiration(Date.from(expiresAt))
                .signWith(signingKey, Jwts.SIG.HS256)
                .compact();
    }

    public Optional<Claims> parseClaims(String token) {
        try {
            return Optional.of(Jwts.parser()
                    .verifyWith(signingKey)
                    .build()
                    .parseSignedClaims(token)
                    .getPayload());
        } catch (JwtException | IllegalArgumentException exception) {
            return Optional.empty();
        }
    }

    public Optional<String> extractEmail(String token) {
        return parseClaims(token).map(Claims::getSubject);
    }

    public Optional<UUID> extractUserId(String token) {
        try {
            return parseClaims(token)
                    .map(claims -> claims.get("userId", String.class))
                    .map(UUID::fromString);
        } catch (IllegalArgumentException exception) {
            return Optional.empty();
        }
    }

    public Optional<Role> extractRole(String token) {
        try {
            return parseClaims(token)
                    .map(claims -> claims.get("role", String.class))
                    .map(Role::valueOf);
        } catch (IllegalArgumentException exception) {
            return Optional.empty();
        }
    }

    public long getExpirationMillis() {
        return expirationMillis;
    }

    private static boolean shouldValidateSecret(Environment environment) {
        return Arrays.stream(environment.getActiveProfiles())
                .noneMatch(profile -> profile.equals("local") || profile.equals("test"));
    }

    private static void validateSecret(String secret) {
        if (secret == null || secret.isBlank()) {
            throw new IllegalStateException("JWT secret must be configured");
        }

        String normalizedSecret = secret.toLowerCase();
        if (secret.length() < MIN_SECRET_LENGTH
                || normalizedSecret.contains("change-me")
                || normalizedSecret.contains("placeholder")
                || normalizedSecret.contains("test-secret")) {
            throw new IllegalStateException("JWT secret must be a strong external secret");
        }
    }

    private static byte[] sha256(String secret) {
        try {
            return MessageDigest.getInstance("SHA-256")
                    .digest(secret.getBytes(StandardCharsets.UTF_8));
        } catch (NoSuchAlgorithmException exception) {
            throw new IllegalStateException("SHA-256 is not available", exception);
        }
    }
}
