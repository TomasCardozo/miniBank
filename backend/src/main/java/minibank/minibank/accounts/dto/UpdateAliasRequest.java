package minibank.minibank.accounts.dto;

import jakarta.validation.constraints.Size;

public record UpdateAliasRequest(
        @Size(max = 100, message = "Alias must have at most 100 characters")
        String alias
) {
}
