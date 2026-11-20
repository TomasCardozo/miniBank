package minibank.minibank.auth.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record RegisterRequest(
        @NotBlank(message = "First name is required")
        @Size(max = 100, message = "First name must have at most 100 characters")
        String firstName,

        @NotBlank(message = "Last name is required")
        @Size(max = 100, message = "Last name must have at most 100 characters")
        String lastName,

        @NotBlank(message = "Email is required")
        @Email(message = "Email must be valid")
        @Size(max = 255, message = "Email must have at most 255 characters")
        String email,

        @NotBlank(message = "Document number is required")
        @Size(max = 50, message = "Document number must have at most 50 characters")
        String documentNumber,

        @NotBlank(message = "Password is required")
        @Size(min = 8, max = 72, message = "Password must have between 8 and 72 characters")
        String password
) {
}
