package minibank.minibank.transfers.dto;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;
import java.util.UUID;

public record CreateTransferRequest(
        @NotNull(message = "Source account id is required")
        UUID sourceAccountId,

        @NotBlank(message = "Target account number is required")
        @Pattern(regexp = "\\d{12}", message = "Target account number must contain 12 digits")
        String targetAccountNumber,

        @NotNull(message = "Amount is required")
        @DecimalMin(value = "0.01", message = "Amount must be greater than zero")
        @Digits(integer = 17, fraction = 2, message = "Amount must have up to 17 integer digits and 2 decimal digits")
        BigDecimal amount,

        @Size(max = 255, message = "Description must have at most 255 characters")
        String description
) {
}
