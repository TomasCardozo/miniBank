package minibank.minibank.config;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.core.annotation.Order;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(controllers = SecurityErrorContractTest.TestSecurityController.class)
@AutoConfigureMockMvc
@Import({
        JsonAuthenticationEntryPoint.class,
        JsonAccessDeniedHandler.class,
        SecurityErrorContractTest.TestSecurityConfig.class
})
class SecurityErrorContractTest {

    private final MockMvc mockMvc;

    @Autowired
    SecurityErrorContractTest(MockMvc mockMvc) {
        this.mockMvc = mockMvc;
    }

    @Test
    void unauthenticatedRequestUsesUniformContract() throws Exception {
        mockMvc.perform(get("/test/security/authenticated"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.status").value(401))
                .andExpect(jsonPath("$.code").value("UNAUTHORIZED"))
                .andExpect(jsonPath("$.message").value("Authentication required"))
                .andExpect(jsonPath("$.path").value("/test/security/authenticated"));
    }

    @Test
    @WithMockUser(roles = "CUSTOMER")
    void forbiddenRequestUsesUniformContract() throws Exception {
        mockMvc.perform(get("/test/security/admin"))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.status").value(403))
                .andExpect(jsonPath("$.code").value("FORBIDDEN"))
                .andExpect(jsonPath("$.message").value("Access denied"))
                .andExpect(jsonPath("$.path").value("/test/security/admin"));
    }

    @RestController
    @RequestMapping("/test/security")
    static class TestSecurityController {

        @GetMapping("/authenticated")
        String authenticated() {
            return "ok";
        }

        @GetMapping("/admin")
        String admin() {
            return "ok";
        }
    }

    @TestConfiguration(proxyBeanMethods = false)
    static class TestSecurityConfig {

        @Bean
        @Order(0)
        SecurityFilterChain testSecurityFilterChain(
                HttpSecurity http,
                JsonAuthenticationEntryPoint authenticationEntryPoint,
                JsonAccessDeniedHandler accessDeniedHandler
        ) throws Exception {
            http
                    .csrf(AbstractHttpConfigurer::disable)
                    .exceptionHandling(exceptionHandling -> exceptionHandling
                            .authenticationEntryPoint(authenticationEntryPoint)
                            .accessDeniedHandler(accessDeniedHandler))
                    .authorizeHttpRequests(authorize -> authorize
                            .requestMatchers("/test/security/admin").hasRole("ADMIN")
                            .anyRequest().authenticated());

            return http.build();
        }
    }
}
