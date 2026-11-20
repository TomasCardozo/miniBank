package minibank.minibank.transfers.repository;

import minibank.minibank.transfers.entity.Transfer;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.Optional;
import java.util.UUID;

public interface TransferRepository extends JpaRepository<Transfer, UUID>, JpaSpecificationExecutor<Transfer> {

    @Override
    @EntityGraph(attributePaths = {"sourceAccount", "targetAccount"})
    Page<Transfer> findAll(Specification<Transfer> specification, Pageable pageable);

    @EntityGraph(attributePaths = {"sourceAccount", "targetAccount"})
    @Query("""
            select transfer from Transfer transfer
            where transfer.id = :transferId
              and (
                transfer.sourceAccount.user.id = :userId
                or transfer.targetAccount.user.id = :userId
              )
            """)
    Optional<Transfer> findOwnById(@Param("transferId") UUID transferId, @Param("userId") UUID userId);

    @Query("""
            select coalesce(sum(transfer.amount), 0)
            from Transfer transfer
            where transfer.sourceAccount.id = :accountId
              and transfer.status = minibank.minibank.transfers.entity.TransferStatus.COMPLETED
              and transfer.completedAt >= :from
              and transfer.completedAt < :to
            """)
    BigDecimal sumCompletedAmountBySourceAccountBetween(
            @Param("accountId") UUID accountId,
            @Param("from") Instant from,
            @Param("to") Instant to
    );
}
