package minibank.minibank.common.exception;

import org.junit.jupiter.api.Test;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import static org.hamcrest.Matchers.empty;
import static org.hamcrest.Matchers.not;
import static org.hamcrest.Matchers.notNullValue;
import static org.hamcrest.Matchers.startsWith;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(controllers = TestErrorController.class)
@AutoConfigureMockMvc(addFilters = false)
class ErrorContractWebMvcTest {

    private final MockMvc mockMvc;

    @Autowired
    ErrorContractWebMvcTest(MockMvc mockMvc) {
        this.mockMvc = mockMvc;
    }

    @Test
    void validationErrorUsesUniformContract() throws Exception {
        mockMvc.perform(post("/test/errors/validation")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.timestamp", notNullValue()))
                .andExpect(jsonPath("$.status").value(400))
                .andExpect(jsonPath("$.code").value("VALIDATION_ERROR"))
                .andExpect(jsonPath("$.message").value("Request validation failed"))
                .andExpect(jsonPath("$.path").value("/test/errors/validation"))
                .andExpect(jsonPath("$.fieldErrors", not(empty())))
                .andExpect(jsonPath("$.fieldErrors[0].field").value("name"));
    }

    @Test
    void notFoundErrorUsesUniformContract() throws Exception {
        mockMvc.perform(get("/test/errors/not-found"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.status").value(404))
                .andExpect(jsonPath("$.code").value("NOT_FOUND"))
                .andExpect(jsonPath("$.message").value("Resource not found"))
                .andExpect(jsonPath("$.path").value("/test/errors/not-found"));
    }

    @Test
    void conflictErrorUsesUniformContract() throws Exception {
        mockMvc.perform(get("/test/errors/conflict"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.status").value(409))
                .andExpect(jsonPath("$.code").value("CONFLICT"))
                .andExpect(jsonPath("$.message").value("Duplicated resource"));
    }

    @Test
    void dataIntegrityErrorDoesNotLeakInternalDetails() throws Exception {
        mockMvc.perform(get("/test/errors/data-integrity"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.status").value(409))
                .andExpect(jsonPath("$.code").value("CONFLICT"))
                .andExpect(jsonPath("$.message").value("Resource conflict"));
    }

    @Test
    void forbiddenDomainErrorUsesUniformContract() throws Exception {
        mockMvc.perform(get("/test/errors/forbidden"))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.status").value(403))
                .andExpect(jsonPath("$.code").value("FORBIDDEN"))
                .andExpect(jsonPath("$.message").value("Operation is not allowed"));
    }

    @Test
    void businessErrorUsesUnprocessableEntityByDefault() throws Exception {
        mockMvc.perform(get("/test/errors/business"))
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.status").value(422))
                .andExpect(jsonPath("$.code").value("BUSINESS_RULE_VIOLATION"))
                .andExpect(jsonPath("$.message").value("Business rule rejected"));
    }

    @Test
    void unexpectedErrorDoesNotLeakStackTraceOrCause() throws Exception {
        mockMvc.perform(get("/test/errors/unexpected"))
                .andExpect(status().isInternalServerError())
                .andExpect(jsonPath("$.status").value(500))
                .andExpect(jsonPath("$.code").value("INTERNAL_ERROR"))
                .andExpect(jsonPath("$.message").value("Unexpected internal error"))
                .andExpect(jsonPath("$.message", not(startsWith("Sensitive"))));
    }

}
