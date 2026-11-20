package minibank.minibank.support;

import minibank.minibank.accounts.entity.Account;
import minibank.minibank.transfers.entity.Transfer;
import minibank.minibank.transfers.entity.TransferStatus;
import org.springframework.test.util.ReflectionTestUtils;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

public final class TestTransferFactory {

    private static final Instant DEFAULT_TIME = Instant.parse("2026-07-26T10:00:00Z");

    private TestTransferFactory() {
    }

    public static Transfer completed(Account source, Account target, String amount) {
        return transfer(source, target, amount, TransferStatus.COMPLETED, null, DEFAULT_TIME);
    }

    public static Transfer transfer(
            Account source,
            Account target,
            String amount,
            TransferStatus status,
            String failureReason,
            Instant completedAt
    ) {
        Transfer transfer = new Transfer(
                source,
                target,
                new BigDecimal(amount),
                source.getCurrency(),
                "test transfer",
                status,
                failureReason,
                completedAt
        );
        ReflectionTestUtils.setField(transfer, "id", UUID.randomUUID());
        ReflectionTestUtils.setField(transfer, "createdAt", DEFAULT_TIME);
        ReflectionTestUtils.setField(transfer, "updatedAt", DEFAULT_TIME);
        return transfer;
    }
}
