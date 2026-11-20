package minibank.minibank.users.service;

import jakarta.persistence.criteria.Predicate;
import minibank.minibank.audit.entity.AuditAction;
import minibank.minibank.audit.entity.AuditEntityType;
import minibank.minibank.audit.service.AuditService;
import minibank.minibank.common.error.ErrorCodes;
import minibank.minibank.common.exception.BusinessException;
import minibank.minibank.common.exception.NotFoundException;
import minibank.minibank.users.dto.AdminUserFilterRequest;
import minibank.minibank.users.dto.AdminUserResponse;
import minibank.minibank.users.entity.User;
import minibank.minibank.users.entity.UserStatus;
import minibank.minibank.users.repository.UserRepository;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Service
public class AdminUserService {

    private static final String USER_NOT_FOUND = "User not found";

    private final UserRepository userRepository;
    private final AuditService auditService;

    public AdminUserService(UserRepository userRepository, AuditService auditService) {
        this.userRepository = userRepository;
        this.auditService = auditService;
    }

    @Transactional(readOnly = true)
    public Page<AdminUserResponse> list(AdminUserFilterRequest filter, Pageable pageable) {
        return userRepository.findAll(users(filter), pageable)
                .map(this::toResponse);
    }

    @Transactional(readOnly = true)
    public AdminUserResponse get(UUID userId) {
        return userRepository.findById(userId)
                .map(this::toResponse)
                .orElseThrow(() -> new NotFoundException(USER_NOT_FOUND));
    }

    @Transactional
    public AdminUserResponse block(UUID adminUserId, UUID targetUserId, String ipAddress) {
        if (adminUserId.equals(targetUserId)) {
            throw new BusinessException(
                    ErrorCodes.BUSINESS_RULE_VIOLATION,
                    "Admin users cannot block themselves",
                    HttpStatus.UNPROCESSABLE_ENTITY
            );
        }

        User user = findUser(targetUserId);
        if (user.getStatus() != UserStatus.ACTIVE) {
            throw new BusinessException(
                    ErrorCodes.BUSINESS_RULE_VIOLATION,
                    "Only active users can be blocked",
                    HttpStatus.UNPROCESSABLE_ENTITY
            );
        }

        UserStatus previousStatus = user.getStatus();
        user.block();
        auditUserStatusChange(adminUserId, user, previousStatus, AuditAction.USER_BLOCKED, ipAddress);
        return toResponse(userRepository.saveAndFlush(user));
    }

    @Transactional
    public AdminUserResponse activate(UUID adminUserId, UUID targetUserId, String ipAddress) {
        User user = findUser(targetUserId);
        if (user.getStatus() != UserStatus.BLOCKED) {
            throw new BusinessException(
                    ErrorCodes.BUSINESS_RULE_VIOLATION,
                    "Only blocked users can be activated",
                    HttpStatus.UNPROCESSABLE_ENTITY
            );
        }

        UserStatus previousStatus = user.getStatus();
        user.activate();
        auditUserStatusChange(adminUserId, user, previousStatus, AuditAction.USER_ACTIVATED, ipAddress);
        return toResponse(userRepository.saveAndFlush(user));
    }

    private User findUser(UUID userId) {
        return userRepository.findById(userId)
                .orElseThrow(() -> new NotFoundException(USER_NOT_FOUND));
    }

    private Specification<User> users(AdminUserFilterRequest filter) {
        return (root, query, criteriaBuilder) -> {
            List<Predicate> predicates = new ArrayList<>();

            if (filter.role() != null) {
                predicates.add(criteriaBuilder.equal(root.get("role"), filter.role()));
            }
            if (filter.status() != null) {
                predicates.add(criteriaBuilder.equal(root.get("status"), filter.status()));
            }

            return criteriaBuilder.and(predicates.toArray(Predicate[]::new));
        };
    }

    private void auditUserStatusChange(
            UUID adminUserId,
            User user,
            UserStatus previousStatus,
            AuditAction action,
            String ipAddress
    ) {
        auditService.record(
                adminUserId,
                action,
                AuditEntityType.USER,
                user.getId(),
                "targetUserId=%s,previousStatus=%s,newStatus=%s".formatted(
                        user.getId(),
                        previousStatus,
                        user.getStatus()
                ),
                ipAddress
        );
    }

    private AdminUserResponse toResponse(User user) {
        return new AdminUserResponse(
                user.getId(),
                user.getFirstName(),
                user.getLastName(),
                user.getEmail(),
                user.getDocumentNumber(),
                user.getRole(),
                user.getStatus(),
                user.getCreatedAt(),
                user.getUpdatedAt()
        );
    }
}
