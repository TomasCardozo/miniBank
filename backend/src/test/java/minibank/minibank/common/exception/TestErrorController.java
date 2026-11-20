package minibank.minibank.common.exception;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/test/errors")
class TestErrorController {

    @PostMapping("/validation")
    void validation(@Valid @RequestBody TestRequest request) {
    }

    @GetMapping("/not-found")
    void notFound() {
        throw new NotFoundException("Resource not found");
    }

    @GetMapping("/conflict")
    void conflict() {
        throw new ConflictException("Duplicated resource");
    }

    @GetMapping("/data-integrity")
    void dataIntegrity() {
        throw new DataIntegrityViolationException("duplicate key value violates unique constraint users_email_key");
    }

    @GetMapping("/forbidden")
    void forbidden() {
        throw new ForbiddenOperationException("Operation is not allowed");
    }

    @GetMapping("/business")
    void business() {
        throw new BusinessException("Business rule rejected");
    }

    @GetMapping("/unexpected")
    void unexpected() {
        throw new IllegalStateException("Sensitive internal detail");
    }

    record TestRequest(@NotBlank String name) {
    }
}
