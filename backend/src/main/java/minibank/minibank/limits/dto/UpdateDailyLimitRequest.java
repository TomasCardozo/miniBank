package minibank.minibank.limits.dto;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.NotNull;

import java.math.BigDecimal;

public record UpdateDailyLimitRequest(
        @NotNull
        @DecimalMin("0.00")
        @Digits(integer = 17, fraction = 2)
        BigDecimal dailyLimit
) {
}
