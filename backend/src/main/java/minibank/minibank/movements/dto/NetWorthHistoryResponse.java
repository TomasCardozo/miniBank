package minibank.minibank.movements.dto;

import java.time.LocalDate;
import java.util.List;

public record NetWorthHistoryResponse(
        LocalDate from,
        LocalDate to,
        String timezone,
        List<NetWorthSeriesResponse> series
) {
}
