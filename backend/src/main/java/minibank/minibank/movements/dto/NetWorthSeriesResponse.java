package minibank.minibank.movements.dto;

import minibank.minibank.accounts.entity.Currency;

import java.math.BigDecimal;
import java.util.List;

public record NetWorthSeriesResponse(
        Currency currency,
        BigDecimal openingBalance,
        List<NetWorthPointResponse> points
) {
}
