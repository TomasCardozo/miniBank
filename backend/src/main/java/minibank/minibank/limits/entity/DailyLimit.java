package minibank.minibank.limits.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.OneToOne;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;
import minibank.minibank.accounts.entity.Account;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

@Getter
@Entity
@Table(name = "daily_limits")
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class DailyLimit {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @OneToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "account_id", nullable = false)
    private Account account;

    @Column(name = "daily_limit", nullable = false, precision = 19, scale = 2)
    private BigDecimal dailyLimit;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    public DailyLimit(Account account, BigDecimal dailyLimit) {
        this.account = account;
        this.dailyLimit = dailyLimit;
    }

    public void updateLimit(BigDecimal dailyLimit) {
        this.dailyLimit = dailyLimit;
    }

    @PrePersist
    void prePersist() {
        Instant now = Instant.now();
        createdAt = now;
        updatedAt = now;
    }

    @PreUpdate
    void preUpdate() {
        updatedAt = Instant.now();
    }
}
