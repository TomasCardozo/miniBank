package minibank.minibank;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Import;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.options;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@ActiveProfiles("test")
@Import(TestcontainersConfiguration.class)
@SpringBootTest
@AutoConfigureMockMvc
class CorsIntegrationTest {

    private final MockMvc mockMvc;

    @Autowired
    CorsIntegrationTest(MockMvc mockMvc) {
        this.mockMvc = mockMvc;
    }

    @Test
    void allowsViteLocalOriginForHealthcheckPreflight() throws Exception {
        mockMvc.perform(options("/actuator/health")
                        .header("Origin", "http://localhost:5173")
                        .header("Access-Control-Request-Method", "GET"))
                .andExpect(status().isOk())
                .andExpect(header().string("Access-Control-Allow-Origin", "http://localhost:5173"))
                .andExpect(header().string("Access-Control-Allow-Methods", "GET,POST,PATCH,OPTIONS"));
    }

    @Test
    void allowsViteLocalOriginForProtectedEndpointPreflightWithAuthorizationHeader() throws Exception {
        mockMvc.perform(options("/auth/me")
                        .header("Origin", "http://localhost:5173")
                        .header("Access-Control-Request-Method", "GET")
                        .header("Access-Control-Request-Headers", "Authorization, Content-Type"))
                .andExpect(status().isOk())
                .andExpect(header().string("Access-Control-Allow-Origin", "http://localhost:5173"))
                .andExpect(header().string("Access-Control-Allow-Methods", "GET,POST,PATCH,OPTIONS"))
                .andExpect(header().string("Access-Control-Allow-Headers", "Authorization, Content-Type"));
    }

    @Test
    void protectedEndpointStillRequiresAuthenticationFromAllowedOrigin() throws Exception {
        mockMvc.perform(get("/auth/me")
                        .header("Origin", "http://localhost:5173"))
                .andExpect(status().isUnauthorized())
                .andExpect(header().string("Access-Control-Allow-Origin", "http://localhost:5173"));
    }
}
