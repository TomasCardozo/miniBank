package minibank.minibank.accounts.repository;

import minibank.minibank.accounts.entity.Account;
import jakarta.persistence.LockModeType;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface AccountRepository extends JpaRepository<Account, UUID>, JpaSpecificationExecutor<Account> {

    @Override
    @EntityGraph(attributePaths = {"user"})
    Page<Account> findAll(Specification<Account> specification, Pageable pageable);

    boolean existsByAccountNumber(String accountNumber);

    List<Account> findByUserIdOrderByCreatedAtDesc(UUID userId);

    Optional<Account> findByIdAndUserId(UUID id, UUID userId);

    @Query("select account.id from Account account where account.id = :accountId and account.user.id = :userId")
    Optional<UUID> findOwnIdByIdAndUserId(@Param("accountId") UUID accountId, @Param("userId") UUID userId);

    boolean existsByIdAndUserId(UUID id, UUID userId);

    Optional<Account> findByAccountNumber(String accountNumber);

    @Query("select account.id from Account account where account.accountNumber = :accountNumber")
    Optional<UUID> findIdByAccountNumber(@Param("accountNumber") String accountNumber);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select account from Account account where account.id = :accountId")
    Optional<Account> findByIdForUpdate(@Param("accountId") UUID accountId);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("""
            select account from Account account
            where account.id = :accountId
              and account.user.id = :userId
            """)
    Optional<Account> findOwnByIdForUpdate(@Param("accountId") UUID accountId, @Param("userId") UUID userId);
}
