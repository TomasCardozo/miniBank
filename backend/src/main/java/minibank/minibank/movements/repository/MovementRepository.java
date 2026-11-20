package minibank.minibank.movements.repository;

import minibank.minibank.movements.entity.Movement;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

public interface MovementRepository extends JpaRepository<Movement, UUID>, JpaSpecificationExecutor<Movement> {

    @Override
    @EntityGraph(attributePaths = {"account", "transfer"})
    Page<Movement> findAll(Specification<Movement> specification, Pageable pageable);

    @Query("""
            select new minibank.minibank.movements.repository.NetWorthMovementRow(
                account.currency,
                movement.type,
                movement.origin,
                movement.amount,
                movement.createdAt,
                sourceAccount.user.id,
                targetAccount.user.id
            )
            from Movement movement
            join movement.account account
            left join movement.transfer transfer
            left join transfer.sourceAccount sourceAccount
            left join transfer.targetAccount targetAccount
            where account.user.id = :userId
              and movement.createdAt >= :from
            """)
    List<NetWorthMovementRow> findNetWorthMovements(@Param("userId") UUID userId, @Param("from") Instant from);
}
