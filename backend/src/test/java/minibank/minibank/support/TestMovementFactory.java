package minibank.minibank.support;

import minibank.minibank.accounts.entity.Account;
import minibank.minibank.movements.entity.Movement;
import minibank.minibank.movements.entity.MovementType;
import minibank.minibank.transfers.entity.Transfer;
import org.springframework.test.util.ReflectionTestUtils;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

public final class TestMovementFactory {

    private static final Instant DEFAULT_TIME = Instant.parse("2026-07-26T10:00:00Z");

    private TestMovementFactory() {
    }

    public static Movement debit(Account account, Transfer transfer, String amount, String balanceAfter) {
        return movement(account, transfer, MovementType.DEBIT, amount, balanceAfter);
    }

    public static Movement credit(Account account, Transfer transfer, String amount, String balanceAfter) {
        return movement(account, transfer, MovementType.CREDIT, amount, balanceAfter);
    }

    public static Movement movement(
            Account account,
            Transfer transfer,
            MovementType type,
            String amount,
            String balanceAfter
    ) {
        Movement movement = new Movement(
                account,
                transfer,
                type,
                new BigDecimal(amount),
                new BigDecimal(balanceAfter),
                "test movement"
        );
        ReflectionTestUtils.setField(movement, "id", UUID.randomUUID());
        ReflectionTestUtils.setField(movement, "createdAt", DEFAULT_TIME);
        return movement;
    }
}
