package minibank.minibank.accounts.dto;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import minibank.minibank.accounts.entity.Currency;

public record CreateAccountRequest(
        @NotNull(message = "Currency is required")
        Currency currency,

        @Size(max = 100, message = "Alias must have at most 100 characters")
        String alias
) {
}
