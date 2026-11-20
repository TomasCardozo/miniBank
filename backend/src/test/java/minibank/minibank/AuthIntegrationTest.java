package minibank.minibank;

import com.fasterxml.jackson.databind.ObjectMapper;
import minibank.minibank.support.DatabaseCleaner;
import minibank.minibank.support.TestAuthClient;
import minibank.minibank.users.entity.UserStatus;
import minibank.minibank.users.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.test.web.servlet.MockMvc;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.notNullValue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@ActiveProfiles("test")
@Import(TestcontainersConfiguration.class)
@SpringBootTest
@AutoConfigureMockMvc
class AuthIntegrationTest {

    private final MockMvc mockMvc;
    private final ObjectMapper objectMapper;
    private final DatabaseCleaner databaseCleaner;
    private final TestAuthClient authClient;
    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;

    @Autowired
    AuthIntegrationTest(
            MockMvc mockMvc,
            JdbcTemplate jdbcTemplate,
            UserRepository userRepository,
            PasswordEncoder passwordEncoder
    ) {
        this.mockMvc = mockMvc;
        this.objectMapper = new ObjectMapper().findAndRegisterModules();
        this.databaseCleaner = new DatabaseCleaner(jdbcTemplate);
        this.authClient = new TestAuthClient(mockMvc, objectMapper);
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
    }

    @BeforeEach
    void setUp() {
        databaseCleaner.clean();
    }

    @Test
    void registerCreatesUserAndReturnsToken() throws Exception {
        mockMvc.perform(post("/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(TestAuthClient.registerJson("user@example.com", "12345678")))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.accessToken", notNullValue()))
                .andExpect(jsonPath("$.tokenType").value("Bearer"))
                .andExpect(jsonPath("$.expiresIn").value(3600000))
                .andExpect(jsonPath("$.user.email").value("user@example.com"))
                .andExpect(jsonPath("$.user.documentNumber").doesNotExist())
                .andExpect(jsonPath("$.user.role").value("CUSTOMER"))
                .andExpect(jsonPath("$.user.status").value("ACTIVE"))
                .andExpect(jsonPath("$.user.password").doesNotExist())
                .andExpect(jsonPath("$.user.passwordHash").doesNotExist());

        var savedUser = userRepository.findByEmail("user@example.com").orElseThrow();
        assertThat(savedUser.getPasswordHash()).isNotEqualTo("password123");
        assertThat(passwordEncoder.matches("password123", savedUser.getPasswordHash())).isTrue();
    }

    @Test
    void registerRejectsDuplicatedEmail() throws Exception {
        register("user@example.com", "12345678");

        mockMvc.perform(post("/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(TestAuthClient.registerJson("user@example.com", "87654321")))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("CONFLICT"))
                .andExpect(jsonPath("$.message").value("Email is already registered"));
    }

    @Test
    void registerRejectsDuplicatedDocumentNumber() throws Exception {
        register("user@example.com", "12345678");

        mockMvc.perform(post("/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(TestAuthClient.registerJson("other@example.com", "12345678")))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("CONFLICT"))
                .andExpect(jsonPath("$.message").value("Document number is already registered"));
    }

    @Test
    void loginReturnsTokenForValidCredentials() throws Exception {
        register("user@example.com", "12345678");

        mockMvc.perform(post("/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(loginJson("user@example.com", "password123")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.accessToken", notNullValue()))
                .andExpect(jsonPath("$.tokenType").value("Bearer"))
                .andExpect(jsonPath("$.user.email").value("user@example.com"))
                .andExpect(jsonPath("$.user.documentNumber").doesNotExist())
                .andExpect(jsonPath("$.user.password").doesNotExist())
                .andExpect(jsonPath("$.user.passwordHash").doesNotExist());
    }

    @Test
    void loginRejectsInvalidPassword() throws Exception {
        register("user@example.com", "12345678");

        mockMvc.perform(post("/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(loginJson("user@example.com", "wrong-password")))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("UNAUTHORIZED"))
                .andExpect(jsonPath("$.message").value("Invalid email or password"));
    }

    @Test
    void loginRejectsUnknownEmailWithGenericUnauthorizedError() throws Exception {
        mockMvc.perform(post("/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(loginJson("missing@example.com", "password123")))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("UNAUTHORIZED"))
                .andExpect(jsonPath("$.message").value("Invalid email or password"));
    }

    @Test
    void meRejectsMissingToken() throws Exception {
        mockMvc.perform(get("/auth/me"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("UNAUTHORIZED"))
                .andExpect(jsonPath("$.message").value("Authentication required"));
    }

    @Test
    void meRejectsInvalidToken() throws Exception {
        mockMvc.perform(get("/auth/me")
                        .header("Authorization", "Bearer not-a-jwt"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("UNAUTHORIZED"));
    }

    @Test
    void meReturnsAuthenticatedUserForValidToken() throws Exception {
        String token = register("user@example.com", "12345678");

        mockMvc.perform(get("/auth/me")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.user.email").value("user@example.com"))
                .andExpect(jsonPath("$.user.documentNumber").value("12345678"))
                .andExpect(jsonPath("$.user.role").value("CUSTOMER"))
                .andExpect(jsonPath("$.user.status").value("ACTIVE"))
                .andExpect(jsonPath("$.user.password").doesNotExist())
                .andExpect(jsonPath("$.user.passwordHash").doesNotExist());
    }

    @Test
    void meRejectsTokenForBlockedUser() throws Exception {
        String token = register("user@example.com", "12345678");
        var user = userRepository.findByEmail("user@example.com").orElseThrow();
        ReflectionTestUtils.setField(user, "status", UserStatus.BLOCKED);
        userRepository.save(user);

        mockMvc.perform(get("/auth/me")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("UNAUTHORIZED"));
    }

    @Test
    void meRejectsTokenForDeletedUser() throws Exception {
        String token = register("user@example.com", "12345678");
        userRepository.deleteAll();

        mockMvc.perform(get("/auth/me")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("UNAUTHORIZED"));
    }

    private String register(String email, String documentNumber) throws Exception {
        return authClient.registerCustomer(email, documentNumber);
    }

    private String loginJson(String email, String password) {
        return """
                {
                  "email": "%s",
                  "password": "%s"
                }
                """.formatted(email, password);
    }
}
