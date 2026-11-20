package minibank.minibank.accounts.dto;

import minibank.minibank.accounts.entity.AccountStatus;
import minibank.minibank.accounts.entity.Currency;

import java.util.UUID;

public record AdminAccountFilterRequest(
        UUID userId,
        AccountStatus status,
        Currency currency
) {
}
