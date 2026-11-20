package minibank.minibank.movements.service;

import minibank.minibank.accounts.entity.Account;
import minibank.minibank.accounts.entity.Currency;
import minibank.minibank.accounts.repository.AccountRepository;
import minibank.minibank.common.error.ErrorCodes;
import minibank.minibank.common.exception.BusinessException;
import minibank.minibank.movements.dto.NetWorthHistoryResponse;
import minibank.minibank.movements.dto.NetWorthPointResponse;
import minibank.minibank.movements.dto.NetWorthSeriesResponse;
import minibank.minibank.movements.entity.MovementOrigin;
import minibank.minibank.movements.entity.MovementType;
import minibank.minibank.movements.repository.MovementRepository;
import minibank.minibank.movements.repository.NetWorthMovementRow;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.Clock;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Collections;
import java.util.EnumMap;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;

@Service
public class NetWorthService {

    public static final ZoneId ZONE = ZoneId.of("America/Argentina/Buenos_Aires");
    static final int DEFAULT_DAYS = 90;
    static final int MAX_DAYS = 366;
    private static final BigDecimal ZERO = new BigDecimal("0.00");

    private final AccountRepository accountRepository;
    private final MovementRepository movementRepository;
    private final Clock clock;

    public NetWorthService(AccountRepository accountRepository, MovementRepository movementRepository, Clock clock) {
        this.accountRepository = accountRepository;
        this.movementRepository = movementRepository;
        this.clock = clock;
    }

    @Transactional(readOnly = true)
    public NetWorthHistoryResponse history(UUID currentUserId, LocalDate from, LocalDate to) {
        LocalDate effectiveTo = to != null ? to : LocalDate.now(clock.withZone(ZONE));
        LocalDate effectiveFrom = from != null ? from : effectiveTo.minusDays(DEFAULT_DAYS - 1L);
        validateRange(effectiveFrom, effectiveTo);

        Map<Currency, BigDecimal> currentBalances = currentBalances(currentUserId);
        Map<Currency, Map<LocalDate, DayFlows>> flows = dailyFlows(
                currentUserId,
                movementRepository.findNetWorthMovements(currentUserId, effectiveFrom.atStartOfDay(ZONE).toInstant())
        );

        List<NetWorthSeriesResponse> series = new ArrayList<>();
        for (Currency currency : Currency.values()) {
            series.add(buildSeries(
                    currency,
                    currentBalances.get(currency),
                    flows.getOrDefault(currency, Map.of()),
                    effectiveFrom,
                    effectiveTo
            ));
        }

        return new NetWorthHistoryResponse(effectiveFrom, effectiveTo, ZONE.getId(), series);
    }

    private void validateRange(LocalDate from, LocalDate to) {
        if (from.isAfter(to)) {
            throw validationError("from must be before or equal to to");
        }
        if (ChronoUnit.DAYS.between(from, to) + 1 > MAX_DAYS) {
            throw validationError("Range must not exceed " + MAX_DAYS + " days");
        }
    }

    private Map<Currency, BigDecimal> currentBalances(UUID currentUserId) {
        Map<Currency, BigDecimal> balances = new EnumMap<>(Currency.class);
        for (Currency currency : Currency.values()) {
            balances.put(currency, ZERO);
        }
        for (Account account : accountRepository.findByUserIdOrderByCreatedAtDesc(currentUserId)) {
            balances.merge(account.getCurrency(), account.getBalance(), BigDecimal::add);
        }
        return balances;
    }

    private Map<Currency, Map<LocalDate, DayFlows>> dailyFlows(UUID currentUserId, List<NetWorthMovementRow> rows) {
        Map<Currency, Map<LocalDate, DayFlows>> flows = new EnumMap<>(Currency.class);
        for (NetWorthMovementRow row : rows) {
            LocalDate date = LocalDate.ofInstant(row.createdAt(), ZONE);
            flows.computeIfAbsent(row.currency(), ignored -> new HashMap<>())
                    .computeIfAbsent(date, ignored -> new DayFlows())
                    .add(row, currentUserId);
        }
        return flows;
    }

    private NetWorthSeriesResponse buildSeries(
            Currency currency,
            BigDecimal currentBalance,
            Map<LocalDate, DayFlows> flowsByDay,
            LocalDate from,
            LocalDate to
    ) {
        BigDecimal closing = currentBalance;
        for (Map.Entry<LocalDate, DayFlows> entry : flowsByDay.entrySet()) {
            if (entry.getKey().isAfter(to)) {
                closing = closing.subtract(entry.getValue().net);
            }
        }

        List<NetWorthPointResponse> points = new ArrayList<>();
        for (LocalDate date = to; !date.isBefore(from); date = date.minusDays(1)) {
            DayFlows day = flowsByDay.getOrDefault(date, DayFlows.EMPTY);
            points.add(new NetWorthPointResponse(date, scaled(closing), scaled(day.externalInflow), scaled(day.externalOutflow)));
            closing = closing.subtract(day.net);
        }
        Collections.reverse(points);

        return new NetWorthSeriesResponse(currency, scaled(closing), points);
    }

    private static BigDecimal scaled(BigDecimal value) {
        return value.setScale(2);
    }

    private static BusinessException validationError(String message) {
        return new BusinessException(ErrorCodes.VALIDATION_ERROR, message, HttpStatus.BAD_REQUEST);
    }

    private static final class DayFlows {

        private static final DayFlows EMPTY = new DayFlows();

        private BigDecimal net = ZERO;
        private BigDecimal externalInflow = ZERO;
        private BigDecimal externalOutflow = ZERO;

        void add(NetWorthMovementRow row, UUID currentUserId) {
            if (row.type() == MovementType.CREDIT) {
                net = net.add(row.amount());
                boolean external = row.origin() == MovementOrigin.ADMIN_CREDIT
                        || !Objects.equals(row.sourceUserId(), currentUserId);
                if (external) {
                    externalInflow = externalInflow.add(row.amount());
                }
            } else {
                net = net.subtract(row.amount());
                if (!Objects.equals(row.targetUserId(), currentUserId)) {
                    externalOutflow = externalOutflow.add(row.amount());
                }
            }
        }
    }
}
