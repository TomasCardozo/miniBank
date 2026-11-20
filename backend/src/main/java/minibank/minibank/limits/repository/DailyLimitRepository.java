package minibank.minibank.limits.repository;

import jakarta.persistence.LockModeType;
import minibank.minibank.limits.entity.DailyLimit;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Optional;
import java.util.UUID;

public interface DailyLimitRepository extends JpaRepository<DailyLimit, UUID> {

    Optional<DailyLimit> findByAccountId(UUID accountId);

    boolean existsByAccountId(UUID accountId);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select dailyLimit from DailyLimit dailyLimit where dailyLimit.account.id = :accountId")
    Optional<DailyLimit> findByAccountIdForUpdate(@Param("accountId") UUID accountId);
}
