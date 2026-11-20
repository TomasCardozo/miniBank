package minibank.minibank.movements.dto;

import java.math.BigDecimal;
import java.time.LocalDate;

public record NetWorthPointResponse(
        LocalDate date,
        BigDecimal closingBalance,
        BigDecimal externalInflow,
        BigDecimal externalOutflow
) {
}
