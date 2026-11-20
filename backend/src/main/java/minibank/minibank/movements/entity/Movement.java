package minibank.minibank.movements.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;
import minibank.minibank.accounts.entity.Account;
import minibank.minibank.transfers.entity.Transfer;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

@Getter
@Entity
@Table(name = "movements")
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class Movement {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "account_id", nullable = false)
    private Account account;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "transfer_id")
    private Transfer transfer;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private MovementType type;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private MovementOrigin origin;

    @Column(nullable = false, precision = 19, scale = 2)
    private BigDecimal amount;

    @Column(name = "balance_after", nullable = false, precision = 19, scale = 2)
    private BigDecimal balanceAfter;

    @Column(length = 255)
    private String description;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    public Movement(
            Account account,
            Transfer transfer,
            MovementType type,
            BigDecimal amount,
            BigDecimal balanceAfter,
            String description
    ) {
        this(account, transfer, type, MovementOrigin.TRANSFER, amount, balanceAfter, description);
    }

    private Movement(
            Account account,
            Transfer transfer,
            MovementType type,
            MovementOrigin origin,
            BigDecimal amount,
            BigDecimal balanceAfter,
            String description
    ) {
        this.account = account;
        this.transfer = transfer;
        this.type = type;
        this.origin = origin;
        this.amount = amount;
        this.balanceAfter = balanceAfter;
        this.description = description;
    }

    public static Movement adminCredit(Account account, BigDecimal amount, BigDecimal balanceAfter, String description) {
        return new Movement(account, null, MovementType.CREDIT, MovementOrigin.ADMIN_CREDIT, amount, balanceAfter, description);
    }

    @PrePersist
    void prePersist() {
        createdAt = Instant.now();
    }
}
