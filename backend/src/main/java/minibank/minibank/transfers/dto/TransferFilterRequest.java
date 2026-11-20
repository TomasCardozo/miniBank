package minibank.minibank.transfers.dto;

import minibank.minibank.transfers.entity.TransferStatus;

import java.time.Instant;
import java.util.UUID;

public record TransferFilterRequest(
        TransferStatus status,
        Instant from,
        Instant to,
        UUID accountId
) {
}
