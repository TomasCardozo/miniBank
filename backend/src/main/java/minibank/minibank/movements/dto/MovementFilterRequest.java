package minibank.minibank.movements.dto;

import minibank.minibank.movements.entity.MovementType;

import java.time.Instant;

public record MovementFilterRequest(
        Instant from,
        Instant to,
        MovementType type
) {
}
